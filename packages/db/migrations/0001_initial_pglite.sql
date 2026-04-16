-- =============================================================================
-- imovi :: 0001_initial_pglite.sql
-- Versão do schema usada nos testes com pglite (Postgres em WASM).
-- Diferenças em relação ao arquivo de produção:
--   - SEM extensões postgis / pg_trgm (não suportadas em pglite).
--   - `geo` vira jsonb (mock de ponto geográfico).
--   - `boundary` vira jsonb (mock de multipolígono).
--   - `gen_random_uuid()` vem do core do Postgres 13+ (pglite já inclui).
--   - Índices GIST/GIN omitidos.
-- =============================================================================

CREATE TABLE IF NOT EXISTS neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  state char(2) NOT NULL,
  name text NOT NULL,
  boundary jsonb,
  median_price_m2 numeric(10, 2),
  listing_count int DEFAULT 0,
  last_aggregated_at timestamptz,
  UNIQUE (city, state, name)
);

CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text UNIQUE NOT NULL,
  address_raw text,
  street text,
  number text,
  neighborhood_id uuid REFERENCES neighborhoods (id) ON DELETE SET NULL,
  city text,
  state char(2),
  cep char(9),
  geo jsonb,
  property_type text,
  area_m2 numeric(8, 2),
  bedrooms int,
  bathrooms int,
  parking int,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

CREATE INDEX IF NOT EXISTS properties_city_state_idx ON properties (city, state);

CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties (id) ON DELETE SET NULL,
  source text NOT NULL,
  source_listing_id text NOT NULL,
  url text,
  title text,
  description text,
  price numeric(14, 2),
  operation text,
  raw_html_ref text,
  scraped_at timestamptz NOT NULL,
  delisted_at timestamptz,
  UNIQUE (source, source_listing_id)
);

CREATE INDEX IF NOT EXISTS listings_property_scraped_idx
  ON listings (property_id, scraped_at DESC);
CREATE INDEX IF NOT EXISTS listings_source_idx ON listings (source);

CREATE TABLE IF NOT EXISTS listing_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  price numeric(14, 2),
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_snapshots_listing_idx
  ON listing_snapshots (listing_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS iptu_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties (id) ON DELETE CASCADE,
  source text,
  tax_year int,
  assessed_value numeric(14, 2),
  iptu_amount numeric(12, 2),
  cadastral_number text,
  raw_payload jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, tax_year, source)
);

CREATE INDEX IF NOT EXISTS iptu_records_property_idx ON iptu_records (property_id);

CREATE TABLE IF NOT EXISTS price_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties (id) ON DELETE SET NULL,
  input_payload jsonb NOT NULL,
  estimate numeric(14, 2),
  confidence_low numeric(14, 2),
  confidence_high numeric(14, 2),
  model_version text NOT NULL,
  features_used jsonb,
  comparables_ids uuid[],
  requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_estimates_property_idx ON price_estimates (property_id);
CREATE INDEX IF NOT EXISTS price_estimates_model_idx ON price_estimates (model_version);

CREATE TABLE IF NOT EXISTS model_versions (
  version text PRIMARY KEY,
  trained_at timestamptz,
  training_rows int,
  metrics jsonb,
  artifact_url text,
  active boolean NOT NULL DEFAULT false,
  notes text
);

CREATE INDEX IF NOT EXISTS model_versions_active_idx ON model_versions (active);

CREATE TABLE IF NOT EXISTS scrape_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text,
  url text,
  error text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scrape_errors_source_idx ON scrape_errors (source, occurred_at DESC);

CREATE TABLE IF NOT EXISTS iptu_fetch_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid,
  adapter text,
  error text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS iptu_fetch_errors_adapter_idx
  ON iptu_fetch_errors (adapter, occurred_at DESC);

CREATE TABLE IF NOT EXISTS opt_out_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  identifier text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS opt_out_requests_status_idx ON opt_out_requests (status);
