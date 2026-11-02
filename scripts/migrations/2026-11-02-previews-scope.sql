-- Preview checks, scope requests, milestones proposed after the job started. Additive only, safe to re-run.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS preview boolean NOT NULL DEFAULT false;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS pending_acceptance boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS scope_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id),
  asked_by text NOT NULL,
  request text NOT NULL,
  verdict text NOT NULL,
  reason text NOT NULL,
  item text,
  title text,
  checklist text[] NOT NULL DEFAULT '{}',
  price_minor integer,
  milestone_id uuid REFERENCES milestones(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE scope_requests ENABLE ROW LEVEL SECURITY;
