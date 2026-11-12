CREATE TABLE IF NOT EXISTS usage_counters (
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric text NOT NULL,
  period_start timestamptz NOT NULL DEFAULT (date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc'),
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, metric, period_start)
);

ALTER TABLE price_estimates ADD COLUMN IF NOT EXISTS owner_user_id text REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS price_estimates_owner_created_idx ON price_estimates(owner_user_id, created_at DESC);
