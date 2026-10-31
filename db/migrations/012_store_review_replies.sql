-- Whether we answered a store review (ASC customerReviewResponses / Play
-- developerComment) — shown on /admin/stats next to each written review.
ALTER TABLE store_reviews ADD COLUMN IF NOT EXISTS replied BOOLEAN;
