-- 020: Google Search Console on /admin/stats (lib/store-import.js search_console,
-- read-only scope webmasters.readonly, nightly). Public search data about our
-- own pages: no user is identified anywhere in it.

-- Search performance per page and day (Search Analytics API, dimensions date + page).
CREATE TABLE IF NOT EXISTS gsc_pages (
  day          DATE    NOT NULL,
  page         TEXT    NOT NULL,              -- absolute URL as Google reports it
  clicks       INTEGER NOT NULL,
  impressions  INTEGER NOT NULL,
  position_sum NUMERIC NOT NULL,              -- avg position × impressions, so periods add up
  PRIMARY KEY (day, page)
);
CREATE INDEX IF NOT EXISTS gsc_pages_page_idx ON gsc_pages (page);

-- Latest index status of each sitemap URL (URL Inspection API, 2,000/day: the
-- import checks the least recently checked ~500 each night).
CREATE TABLE IF NOT EXISTS gsc_index (
  page          TEXT        PRIMARY KEY,
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verdict       TEXT,                         -- PASS | NEUTRAL | FAIL | VERDICT_UNSPECIFIED
  coverage      TEXT,                         -- e.g. "Submitted and indexed", "Crawled - currently not indexed"
  last_crawl    TIMESTAMPTZ
);
