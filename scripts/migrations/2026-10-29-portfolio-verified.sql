-- "Verified owner" badge: the portfolio link that carried the user's ownership code when last checked.
-- Additive only, safe to re-run.
ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio_verified_url text;
