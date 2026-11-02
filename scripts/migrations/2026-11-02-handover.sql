-- Handover check: the client confirms what they received. Additive only, safe to re-run.
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS confirmed boolean;
