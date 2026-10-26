-- Trust features (review window, disputes, replays, webhooks). Additive only, safe to re-run.
BEGIN;

ALTER TABLE milestones ADD COLUMN IF NOT EXISTS release_at timestamp with time zone;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS captured_minor integer;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS paypal_dispute_id text;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS paypal_dispute_status text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL CONSTRAINT "disputes_milestoneId_unique" UNIQUE
    CONSTRAINT disputes_milestone_id_milestones_id_fk REFERENCES milestones(id),
  opened_by text NOT NULL,
  client_statement text,
  freelancer_statement text,
  status text NOT NULL DEFAULT 'open',
  judge_share integer,
  judge_reasoning text,
  decide_at timestamp with time zone,
  client_accepted boolean NOT NULL DEFAULT false,
  freelancer_accepted boolean NOT NULL DEFAULT false,
  rejected_by text,
  final_share integer,
  admin_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS replays (
  submission_id uuid PRIMARY KEY
    CONSTRAINT replays_submission_id_submissions_id_fk REFERENCES submissions(id) ON DELETE CASCADE,
  mp4 bytea NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paypal_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  milestone_id uuid CONSTRAINT paypal_events_milestone_id_milestones_id_fk REFERENCES milestones(id) ON DELETE SET NULL,
  payload jsonb NOT NULL,
  received_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Supabase: no public API access to these tables; the app connects as the owner.
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE replays ENABLE ROW LEVEL SECURITY;
ALTER TABLE paypal_events ENABLE ROW LEVEL SECURITY;

COMMIT;
