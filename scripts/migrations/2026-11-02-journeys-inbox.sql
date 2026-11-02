-- Customer journeys and the inbox check. Additive only, safe to re-run.
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'item';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS inbox_code text;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS inbox_confirmed boolean;
