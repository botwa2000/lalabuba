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
- [ ] **5. Provision non-root `deploy` user** + app dirs `/opt/lalabuba`,
  `/opt/lalabuba-dev`; GitHub deploy key (separate from server key).
- [ ] **6. Push all runtime secrets** to Swarm (`lalabuba_{env}_*`): image
  providers (HF/Together/Novita/CF), Turnstile secret, APP_API_KEY, R2 keys,
  DATABASE_URL (done).
- [ ] **7. Deploy scripts** — `scripts/deploy.sh` + Windows-safe
  `scripts/remote-deploy.sh`; `.secrets.example`; `.gitignore`.
- [ ] **8. nginx** — `lalabuba.com` + `dev.lalabuba.com` server blocks → 3020/
  3021; Cloudflare Origin cert installed.
- [ ] **9. Deploy DEV** → build, stack deploy, health-check `dev.lalabuba.com`.
- [ ] **10. GitHub Actions** — `ci.yml`, `deploy-dev.yml` (auto on `dev`),
  `deploy-prod.yml` (manual, protected).
- [ ] **11. VERIFY GATE (web)** — `scripts/deploy.sh push` + dev deploy succeed;
  generation + coloring work end-to-end on `dev.lalabuba.com`.
- [ ] **12. VERIFY GATE (mobile)** — point Flutter `AppConfig.generateUrl` at the
  Hetzner API; build + a successful generation from the app; trigger a store
  build (and save a local APK per standing rule).
- [ ] **13. Cloudflare DNS cutover** — point `lalabuba.com` + `dev.` A/proxied
  records to `91.99.212.17` (Full-Strict). **GATED:** needs a valid DNS-scoped
  Cloudflare API token (the one in `.env` is invalid) OR a manual change by owner.
- [ ] **14. Deploy PROD** + verify `lalabuba.com` live on Hetzner.
- [ ] **15. DISCONTINUE VERCEL** — only after 11–14 pass: remove the Vercel
  project/domain, revoke Vercel Blob token (after R2 cutover), update repo docs.

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
