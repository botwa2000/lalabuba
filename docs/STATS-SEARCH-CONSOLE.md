# Search Console on /admin/stats: one-time access

The "🔎 Google Search" panel on `/admin/stats` is filled nightly by the `search_console` feed in
`lib/store-import.js` (tables from `db/migrations/020_search_console.sql`). It uses the **same Google
service account as the Play feeds** (`PLAY_SERVICE_ACCOUNT_JSON`, already a Swarm secret) and asks only for
the read-only scope `webmasters.readonly`. No new secret, nothing in the repo.

What it imports:
- clicks, impressions and average position per page and day, last 30 days (Search Analytics API);
- the index status of every sitemap URL, about 500 a night, least recently checked first
  (URL Inspection API, 2,000/day limit), so a full pass over ~3,200 URLs takes about a week.

Until access is granted, `🩺 Health & imports` → `search_console` and the panel itself say which step is
missing. Both steps are done by the owner of the Search Console property.

## 1. Turn on the Search Console API in the service account's Cloud project

If the panel says "Search Console API is off", open the link it shows (it names the project) while signed in
with the Google account that owns the Play / Cloud project, and click **Enable**. It can take a few minutes.

## 2. Give the service account read access to the property

1. The service account's address is the `…@….iam.gserviceaccount.com` user in Google Play Console →
   **Users and permissions** (the panel's "no access" message shows it too).
2. <https://search.google.com/search-console> → property **lalabuba.com** (`sc-domain:lalabuba.com`).
3. **Settings → Users and permissions → Add user**: paste the address, permission **Restricted**, **Add**.

## 3. Check

On `/admin/stats` click **↻ Store import** (or wait for the nightly run). If more than one lalabuba.com
property is visible to the account, set `GSC_SITE_URL` (e.g. `sc-domain:lalabuba.com`) as a Swarm secret.
