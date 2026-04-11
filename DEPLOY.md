# Deploy

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

## Trigger CI from Claude

When asking Claude to deploy, say **"push to dev and prod"** — Claude will run `deploy.sh` as a single command.

## Android CI

A push to `main` that touches any of these paths triggers the Android build + Play Store upload automatically:

```
public/**
android/**
capacitor.config.json
package.json
```

Monitor builds at: https://github.com/botwa2000/lalabuba/actions

The new build lands in Play Console → Internal testing as a draft. Open the release and tap **"Start rollout"** to make it available to testers.

## Reset onboarding for testing

The onboarding overlay shows once per device, gated by `localStorage`. To see it again after it's been dismissed:

```js
// In the app's WebView console (Chrome DevTools → chrome://inspect)
localStorage.removeItem('lalabuba-onboarded');
location.reload();
```

Or uninstall and reinstall the app.
