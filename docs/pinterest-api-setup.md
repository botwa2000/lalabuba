# Pinterest API publishing — setup checklist

**Written 2026-10-10.** These steps are for Alex. Each one either involves logging in as you or
handling an app secret, so Claude can't do them.

Requirements below are taken from Pinterest's own docs as of 2026-10-10:
[access tiers](https://developers.pinterest.com/docs/key-concepts/access-tiers/) and
[authentication](https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/).
The request formats were checked against the
[v5 OpenAPI spec](https://github.com/pinterest/api-description) (version 5.28.0).

---

## Why Standard access is mandatory

A new app starts on **Trial** access. *"All Pins and Boards created with Trial access are only
visible to their creator as Sandbox entities."* A Trial pin reaches nobody, so it is useless for growth.
The runner won't post pins until `PINTEREST_STANDARD_ACCESS` is `true` in
`scripts/social/config.mjs`. Flip it only after Pinterest emails that Standard access is approved.

## How it fits together

- **One** Pinterest app.
- **One OAuth authorization per brand profile.** Lalabuba (`@lalabubaAI`) and Bonifatus are separate
  profiles, so each one authorizes the app separately and gets its own refresh token.
- Each refresh token goes straight to the prod Swarm secret `PINTEREST_<BRAND>_REFRESH_TOKEN`,
  over SSH stdin. It is never printed and never written to disk.
- The `social` service turns the refresh token into access tokens. It renews them 10 days before
  they expire. You get an email if any credential gets within 7 days of expiring.

---

## Checklist

### A. Create the app (about 10 min)

1. Log in to **pinterest.com as the Lalabuba profile**. Use a personal or business login only.
   Nothing is linked to Meta, and Bonifatus's Meta restriction doesn't apply to Pinterest.
2. Go to <https://developers.pinterest.com/apps/> → **Connect app** (or **Create app**).
3. Fill in the app details:
   - **App name:** `Lalabuba Publisher`
   - **Description / use case:** *"Publishes our own pre-approved pins to our own two brand
     profiles (Lalabuba, Bonifatus) on a schedule of at most one pin per profile per day. No third-party
     users. Every pin is chosen and approved by a human before it is queued."*
   - **Website:** `https://lalabuba.com`
   - **Privacy policy URL:** `https://lalabuba.com/privacy` (check that it loads first)
4. Under **Redirect URIs**, add exactly `http://localhost:8085/`, including the trailing slash.
5. Submit. Wait for the **Trial** approval email.
6. Copy the **App ID** and **App secret key** from the app card. Add them to the gitignored repo
   `.env`:
   ```
   PINTEREST_APP_ID=...
   PINTEREST_APP_SECRET=...
   ```

### B. Authorize both profiles — record this as the review video (about 5 min)

Pinterest requires a video that **shows the OAuth flow and the live integration**. The docs say that
*"screen recordings of terminal calls … are accepted"* when you are the only user. So this step
**is** the demo video. Start a screen recording first (Win+Alt+R, or OBS) and keep it running
through step 11.

7. In a terminal at the repo root:
   ```
   node scripts/pinterest-publish.mjs --auth --brand lalabuba
   ```
8. Open the printed URL in the browser where you're logged in as **Lalabuba**. Approve the
   requested scopes: `boards:read, boards:write, pins:read, pins:write, user_accounts:read`.
9. The terminal shows **"Authorized Pinterest account: lalabubaAI"**. Check the name, then
   type `y`. The refresh token and the app ID and secret go to the prod secrets.
10. Show the integration working:
    ```
    node scripts/pinterest-publish.mjs --brand lalabuba --dry-run `
      --image https://lalabuba.com/social/pins/pin_dragon.jpg --board "Coloring Pages for Kids" `
      --title "Dragon Coloring Pages – Free Printable for Kids" --description "…" `
      --link https://lalabuba.com/en/coloring-pages/dragon/
    ```
    The exact `POST /v5/pins` request is printed, so the reviewer can see what gets sent.
11. **Switch the browser to the Bonifatus profile.** Confirm it by the profile link, not the header
    chip (see the 9/20 incident in the growth log). Then run:
    ```
    node scripts/pinterest-publish.mjs --auth --brand bonifatus
    ```
    Check that the account name is the Bonifatus one (`BonifatusSchoolGradesReward`) before you type `y`.
    **If it shows `lalabubaAI`, type N.** The browser is still logged in as the wrong profile.

Stop the recording.

### C. Request Standard access (about 5 min, then a wait of unknown length)

12. Go to <https://developers.pinterest.com/apps/> → the app card → **Upgrade**. The button only shows
    once Trial is approved.
13. Check the app details: use case and privacy policy link, as in step 3.
14. Upload the video from step B and submit.
15. Wait for the decision email. Pinterest publishes **no timeline**, and developer-forum reports
    describe waits of 3–5 weeks.

**Common rejection reasons, so avoid them:** the video doesn't show the full OAuth flow, or it doesn't
show the actual Pinterest integration. Steps 8–10 cover both.

### D. Turn it on (needs Claude or a code edit)

16. After approval, ask Claude to set `PINTEREST_STANDARD_ACCESS = true` in
    `scripts/social/config.mjs`, then commit and deploy prod.
17. Run `npm run social:plan` and check the week ahead.

---

## Day-to-day

- **Queue posts:** add entries to `queue.yaml`. To approve one, add `approved: "YYYY-MM-DD AP"` yourself,
  then commit and push to `main`. The service reads the queue straight from GitHub, so no deploy is needed.
- **See what will post:** run `npm run social:plan` locally. For the server's view, with live
  account readiness and token expiry dates:
  ```
  ssh root@<host> 'docker exec $(docker ps -q -f name=lalabuba-prod_social) node scripts/social/runner.mjs --plan'
  ```
- **Expiry alert email received:** re-run step 7 (or 11) for that brand. The new seed replaces the
  stored token chain automatically.
- **"post uncertain" email received:** check the profile. If the pin did *not* go out, edit
  `/opt/lalabuba/data/social/published.json` on the server and set that row's `"status"` to
  `"failed"`. It will then post on a later day.
