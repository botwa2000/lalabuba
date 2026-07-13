# Deploy & Access Reference

This file is the persistent guide for CI/CD and external service access.
Update it whenever credentials, workflows, or integrations change.

---

## Quick deploy (commit + push dev + push main)

```bash
./deploy.sh "your commit message"
```

What it does:
1. `git add -A` — stages all changes
2. `git commit -m "..."` — commits with your message
3. `git push origin dev`
4. Fast-forward merges dev → main and pushes
5. Returns to the dev branch

---

## Repo / GitHub

- **Remote:** `git@github.com:botwa2000/lalabuba.git` (SSH)
- **GitHub user:** `botwa2000`
- **Main branch:** `main` — all CI auto-triggers fire on push to `main`
- **Monitor builds:** https://github.com/botwa2000/lalabuba/actions

```powershell
# Check latest CI run status (no auth needed)
$r = Invoke-RestMethod "https://api.github.com/repos/botwa2000/lalabuba/actions/runs?per_page=15"
$r.workflow_runs | Select-Object name, conclusion, created_at, @{n='sha';e={$_.head_sha.Substring(0,7)}} | Format-Table
```

---

## Android — Google Play

- **Pipeline:** GitHub Actions → `.github/workflows/android-release.yml`
- **Trigger:** push to `main` (automatic, path-filtered)
- **Watched paths:** `flutter_app/**`, `public/**`
- **Status check:** see GitHub Actions link above — all recent builds green
- The new build lands in Play Console → Internal testing as a draft.
  Open the release and tap **"Start rollout"** to make it available.

---

## iOS — TestFlight / App Store

- **Pipeline:** **Codemagic** (not GitHub Actions)
- **Config file:** `codemagic.yaml` in repo root
- **Trigger:** push to `main` (automatic via Codemagic webhook)
- **Codemagic dashboard:** https://codemagic.io
- **Codemagic account:** alexander.perel@gmail.com (Bonistock team)
- **App Store Connect integration name:** `Bonistock ASC`
- **Bundle ID:** `com.lalabuba.lalabuba`
- **App Store Apple ID:** `6761691648`
- **Codemagic App ID:** `69d2bd72c09ad496ab57741d`

### Codemagic API token

Stored in: `C:\Users\Alexa\OneDrive\Dev\bonifatus-secrets\KEYSTORE-CREDENTIALS.txt`
Key name: `CODEMAGIC_API_TOKEN`

```powershell
# Check recent Codemagic builds
$token = "<CODEMAGIC_API_TOKEN from bonifatus-secrets/KEYSTORE-CREDENTIALS.txt>"
$headers = @{ "x-auth-token" = $token }
$appId = "69d2bd72c09ad496ab57741d"
$builds = Invoke-RestMethod "https://api.codemagic.io/builds?appId=$appId&limit=10" -Headers $headers
$builds.builds | Select-Object index, status, branch, startedAt, finishedAt | Format-Table -AutoSize
```

### If iOS builds stop triggering

Most likely cause: broken GitHub→Codemagic webhook.
Fix: **Codemagic dashboard → App → Settings → Repository → Regenerate webhook**

> The GitHub Actions iOS file (`.github/workflows/ios-release.yml`) is set to
> `workflow_dispatch` only — intentionally disabled. Codemagic is the canonical iOS pipeline.

---

## Hetzner — production server

- **Server:** `91.99.212.17` (taxalex box, Docker Swarm)
- **Prod URL:** `https://lalabuba.com` → port 3020
- **Dev URL:** `https://dev.lalabuba.com` → port 3021
- **Deploy:** `scripts/deploy.sh push "msg"` (commit + push); `scripts/deploy.sh dev` or `prod` (deploy to server)
- **SSH key:** from `C:\Users\Alexa\taxalex\.secrets` (`HETZNER_SSH_KEY`, `HETZNER_HOST`, `HETZNER_USER`)

---

## Environment variables (`.env` — gitignored)

| Key | Service | Notes |
|-----|---------|-------|
| `HF_TOKEN` | Hugging Face | Image generation fallback |
| `TOGETHER_API_KEY` | Together AI | AI fallback (currently dead — 402) |
| `CF_ACCOUNT_ID` | Cloudflare | Workers AI (currently dead — 401) |
| `CF_API_TOKEN` | Cloudflare | Workers AI (currently dead — 401) |
| `NOVITA_API_KEY` | Novita.ai | Primary paid AI provider |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile | Web bot protection |
| `RESEND_API_KEY` | Resend | Contact form email |
| `CM_API_TOKEN` | Codemagic | In `bonifatus-secrets/KEYSTORE-CREDENTIALS.txt` |

---

## How Claude accesses services each session

Memory resets each session — use this file as the source of truth.

1. **GitHub status** — no token needed; use `Invoke-RestMethod` against public API (see snippet above)
2. **Codemagic status** — get `CM_API_TOKEN` from `bonifatus-secrets/KEYSTORE-CREDENTIALS.txt`, use API snippets above
3. **Hetzner SSH** — key path + host + user from `C:\Users\Alexa\taxalex\.secrets`
4. **All credentials** — check `.env` first; table above lists what's stored

---

## Reset onboarding for testing

**Web browser:** open DevTools console and run:
```js
localStorage.removeItem('lalabuba-onboarded');
location.reload();
```

**Flutter app:** uninstall and reinstall the app (clears `flutter_secure_storage`).
