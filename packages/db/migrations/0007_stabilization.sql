-- Additive stabilization. Back up and preflight duplicate snapshot timestamps
-- before applying to staging; do not delete historical observations to fit an index.
ALTER TABLE neighborhoods
  ADD COLUMN IF NOT EXISTS price_source text NOT NULL DEFAULT 'seed_reference';
ALTER TABLE price_estimates
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'heuristic',
  ADD COLUMN IF NOT EXISTS result_metadata jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS listing_snapshots_listing_captured_ux
  ON listing_snapshots (listing_id, captured_at);
ALTER TABLE listing_snapshots
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id),
  ADD COLUMN IF NOT EXISTS operation text;
-- Only the latest matching observation has a known historical association.
UPDATE listing_snapshots s SET property_id = l.property_id, operation = l.operation
FROM listings l WHERE s.listing_id = l.id AND s.captured_at = l.scraped_at
  AND s.property_id IS NULL AND s.operation IS NULL;
-- Preserve only the last observation we actually have; never invent history.
INSERT INTO listing_snapshots (listing_id, property_id, operation, price, captured_at)
SELECT id, property_id, operation, price, scraped_at FROM listings WHERE price IS NOT NULL
ON CONFLICT (listing_id, captured_at) DO NOTHING;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS billing_last_event_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_lease_token text,
  ADD COLUMN IF NOT EXISTS billing_lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_checkout_token text,
  ADD COLUMN IF NOT EXISTS billing_checkout_plan_id text,
  ADD COLUMN IF NOT EXISTS billing_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS billing_checkout_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_checkout_request jsonb;

-- Old rows represented already-consumed events; preserve that meaning.
ALTER TABLE billing_events
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS lease_token text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE billing_events ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE billing_events ALTER COLUMN processed_at DROP NOT NULL;
ALTER TABLE billing_events ALTER COLUMN processed_at DROP DEFAULT;
CREATE INDEX IF NOT EXISTS billing_events_recovery_idx ON billing_events (status, lease_expires_at);

CREATE TABLE IF NOT EXISTS waitlist_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  source text NOT NULL,
  consent_version text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS api_rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1 CHECK (count > 0)
);
CREATE INDEX IF NOT EXISTS api_rate_limits_window_idx ON api_rate_limits (window_start);
