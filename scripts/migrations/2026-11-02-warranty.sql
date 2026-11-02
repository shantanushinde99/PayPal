-- Warranty holdback with monitoring. Additive only, safe to re-run. Existing jobs keep 0% (no warranty).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS warranty_percent integer NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS warranty_days integer NOT NULL DEFAULT 7;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS warranty_minor integer;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS warranty_until timestamptz;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS warranty_status text;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS warranty_issue text;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS warranty_checked_at timestamptz;
