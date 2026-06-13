# Lalabuba — Vercel → Hetzner Migration

Chosen approach (decided autonomously; no per-step confirmation needed). Both
**dev and prod** are set up during migration (best practice, mirrors taxalex/
bonifatus/bonistock on the same box). Vercel is **discontinued only after** web
**and** mobile pushes are verified working against Hetzner.

## Target topology
- **Server:** `91.99.212.17` (the taxalex box). Verified: 7.6 GB RAM (5.4 GB
  free), 54 GB disk free, Docker Swarm active, PostgreSQL 16 running. Plenty of
  headroom alongside taxalex.
- **Domains / ports:** `lalabuba.com` → :3020 (prod), `dev.lalabuba.com` → :3021
  (dev), `admin.lalabuba.com` → :3030 (admin panel, later). nginx + Cloudflare
  Origin cert (Full-Strict), Cloudflare proxied.
- **App:** the existing Node app (`server.js` + `lib/` + `public/`) containerized.
  `server.js` already implements `/api/generate-image`; bring the Vercel
  function's extras (per-IP rate-limit, Turnstile verify, durable quota) into it.
- **Object storage:** Vercel Blob → **Cloudflare R2** (S3-compatible) behind the
  existing `blobPut/blobList/blobDel` abstraction. (MinIO is the fallback.)
- **DB:** isolated `lalabuba_prod` / `lalabuba_dev` on the shared Postgres, owned
  by a non-superuser `lalabuba` role.

## Secret model
- Runtime → **Docker Swarm secrets**, `lalabuba_{env}_` prefix, loaded by
  `docker-entrypoint.sh`. Source → 1Password/Bitwarden CLI (bootstrap: chmod-600
  `.secrets`). Never in image/repo/disk/`.md`.

## Step sequence & status

- [x] **0. Verify access & capacity** — SSH OK (key `id_rsa`, user root), 7.6 GB
  RAM free, Swarm active, PG16 up.
- [x] **1. Create DB** — `lalabuba` role (non-superuser) + `lalabuba_prod` /
  `lalabuba_dev`; `DATABASE_URL`s stored as Swarm secrets (generated server-side,
  never printed); pg_hba rule for `lalabuba` from the docker bridge added +
  reloaded.
- [x] **2. Capture deploy process + cred retrieval + server id** → `CLAUDE.md`
  (pointers, no secrets) + memory `project-hetzner-migration.md`.
- [x] **3. Containerize** — `Dockerfile` (node:20-alpine, non-root `node`,
  healthcheck), `docker-entrypoint.sh` (Swarm-secret loader, strips
  `lalabuba_${APP_ENV}_`), `.dockerignore`, `.secrets.example`. (Stack files
  written in step 6 once the secret set is final.)
- [x] **4. Port server** — `server.js` now reuses the production `api/*` handlers
  verbatim via a thin http→Express shim (single logic source); serves static +
  `/api/health` + `/api/generate-image` + `/api/contact`. **Verified locally:**
  health ok, static 200, 405 on bad method, handlers load. Blob stays optional/
  inert at launch (MinIO fast-follow).
- [~] **5. Provision** — `/opt/lalabuba{,-dev}` created; deploy runs as root
  (matches other apps). Code currently delivered via **tar-over-SSH** (the GitHub
  PAT lacks `Administration` scope, so the deploy key couldn't be registered via
  API; clone is blocked). **Owner action:** add the deploy key (printed in
  session) to the repo, or grant an admin-scoped PAT, to enable git-pull/CI.
- [~] **6. Push runtime secrets** — DEV done (`lalabuba_dev_*`: DATABASE_URL, HF,
  Together, Novita, CF, BLOB). PROD pending — needs TURNSTILE_SECRET_KEY +
  RESEND_API_KEY which are Vercel-only (not in local `.env`).
- [ ] **7. Deploy scripts** — `scripts/deploy.sh` + `scripts/remote-deploy.sh`.
- [x] **8. nginx + TLS** — `nginx/lalabuba.com` vhost (prod→3020, dev→3021), real
  client IP via `cf_connecting_ip`. **Let's Encrypt cert** for lalabuba.com +
  www + dev issued via **DNS-01** (Cloudflare DNS token; key server-side).
- [x] **9. Deploy DEV — DONE & VERIFIED.** `dev.lalabuba.com` live: health 200,
  static 200, TLS valid, and **live image generation returns a real PNG**
  (internal + external through Cloudflare). Waterfall hardened to skip
  auth-failed tiers. `dev.lalabuba.com` A→91.99.212.17 (proxied) created.
- [ ] **10. GitHub Actions** — `ci.yml`, `deploy-dev.yml` (auto on `dev`),
  `deploy-prod.yml` (manual, protected).
- [ ] **11. VERIFY GATE (web)** — `scripts/deploy.sh push` + dev deploy succeed;
  generation + coloring work end-to-end on `dev.lalabuba.com`.
- [ ] **12. VERIFY GATE (mobile)** — point Flutter `AppConfig.generateUrl` at the
  Hetzner API; build + a successful generation from the app; trigger a store
  build (and save a local APK per standing rule).
- [x] **13. Cloudflare DNS cutover — DONE.** `lalabuba.com` + `www` A records
  flipped 216.198.79.1 (Vercel) → 91.99.212.17 (Hetzner), proxied. Verified live:
  `/api/health` (an endpoint that exists only on the new server) returns ok via
  the real domain — proves traffic hits Hetzner, not Vercel.
- [x] **14. Deploy PROD — DONE & LIVE.** `lalabuba.com` serving on Hetzner:
  health/index/www 200, **live generation returns a real PNG**. Prod provider
  keys: Vercel-stored HF/Novita were stale (401); replaced with the working local
  `.env` keys (Novita is the live tier). Turnstile secret active for web bot
  protection. Server dirs converted to git clones (deploy key registered).
- [ ] **15. DISCONTINUE VERCEL** — pending: (a) finish deploy scripts + CI and
  verify a web push deploys, (b) verify mobile generates against Hetzner, THEN
  remove the Vercel project/domain. Vercel project still exists (now receives no
  traffic). MinIO/R2 to replace Vercel Blob before revoking the Blob token.

## Verification gates (hard requirements before discontinuing Vercel)
1. `git push` → CI → **dev deploy** to Hetzner succeeds and the site works.
2. **Web prod** on Hetzner serves and generates images correctly.
3. **Mobile** app generates against the Hetzner API; a store build succeeds.
Only then: step 15.

## Rollback
DNS is the kill-switch: until step 13, Vercel still serves prod, so all Hetzner
work is non-disruptive. If a Hetzner deploy is bad, `docker service rollback` or
revert DNS to Vercel. Vercel project stays intact until step 15.

## Gated items needing the owner
- **Cloudflare:** a DNS-edit-scoped API token for the `lalabuba.com` zone (or
  confirm the zone is in your Cloudflare account so I can request the right
  token). Current `.env` token is invalid.
- **1Password/Bitwarden CLI:** install + `op signin` (run `! op signin`) to switch
  the cred source off the bootstrap `.secrets`. Optional; migration proceeds
  without it.
