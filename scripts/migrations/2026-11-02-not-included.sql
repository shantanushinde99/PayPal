-- Expectation finder: what both sides agreed is NOT part of a milestone. Additive only, safe to re-run.
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS excluded text[] NOT NULL DEFAULT '{}';
