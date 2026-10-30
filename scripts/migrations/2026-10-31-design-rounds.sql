-- Design approval milestones and included revision rounds. Additive only, safe to re-run.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS revision_rounds integer NOT NULL DEFAULT 2;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS change_requests integer NOT NULL DEFAULT 0;
