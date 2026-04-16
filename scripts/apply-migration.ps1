# =============================================================================
# apply-migration.ps1 — Aplica 0001_initial.sql no Neon via API REST
#
# Uso:
#   $env:NEON_API_KEY = "sua-api-key"
#   .\scripts\apply-migration.ps1
# =============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$NEON_API   = "https://console.neon.tech/api/v2"
$PROJECT_ID = "wandering-sea-53511196"
$BRANCH_ID  = "br-damp-river-ajs5xjm5"   # branch main
$DB_NAME    = "neondb"

if (-not $env:NEON_API_KEY) {
    Write-Error "NEON_API_KEY não definido."
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $env:NEON_API_KEY"
    "Content-Type"  = "application/json"
}

# Endpoint correto da Neon SQL HTTP API
$queryUrl = "$NEON_API/projects/$PROJECT_ID/branches/$BRANCH_ID/query"

function Invoke-NeonSQL {
    param([string]$sql, [string]$label)
    $body = @{ query = $sql; database_name = $DB_NAME } | ConvertTo-Json -Depth 3 -Compress
    try {
        $null = Invoke-RestMethod -Method Post -Uri $queryUrl -Headers $headers -Body $body
        Write-Host "  ✓ $label" -ForegroundColor Green
    } catch {
        $msg = $_.ErrorDetails.Message
        # Ignorar erros de "já existe" — idempotente
        if ($msg -match "already exists" -or $msg -match "duplicate") {
            Write-Host "  ~ $label (já existe, ok)" -ForegroundColor DarkYellow
        } else {
            Write-Warning "  ✗ $label`n    $msg"
            throw
        }
    }
}

Write-Host "→ Aplicando migration no Neon (projeto $PROJECT_ID, branch main)..." -ForegroundColor Cyan
Write-Host ""

# Extensions
Invoke-NeonSQL "CREATE EXTENSION IF NOT EXISTS postgis"    "postgis"
Invoke-NeonSQL "CREATE EXTENSION IF NOT EXISTS pgcrypto"   "pgcrypto"
Invoke-NeonSQL "CREATE EXTENSION IF NOT EXISTS pg_trgm"    "pg_trgm"

# neighborhoods
Invoke-NeonSQL @"
CREATE TABLE IF NOT EXISTS neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  state char(2) NOT NULL,
  name text NOT NULL,
  boundary geography(MultiPolygon, 4326),
  median_price_m2 numeric(10, 2),
  listing_count int DEFAULT 0,
  last_aggregated_at timestamptz,
  UNIQUE (city, state, name)
)
"@ "TABLE neighborhoods"

# properties
Invoke-NeonSQL @"
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
  geo geography(Point, 4326),
  property_type text,
  area_m2 numeric(8, 2),
  bedrooms int,
  bathrooms int,
  parking int,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
)
"@ "TABLE properties"

Invoke-NeonSQL "CREATE INDEX IF NOT EXISTS properties_geo_gix ON properties USING GIST (geo)"              "INDEX properties_geo_gix"
Invoke-NeonSQL "CREATE INDEX IF NOT EXISTS properties_city_state_idx ON properties (city, state)"           "INDEX properties_city_state_idx"
Invoke-NeonSQL "CREATE INDEX IF NOT EXISTS properties_street_trgm_idx ON properties USING GIN (street gin_trgm_ops)" "INDEX properties_street_trgm_idx"

# listings
Invoke-NeonSQL @"
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
)
"@ "TABLE listings"

Invoke-NeonSQL "CREATE INDEX IF NOT EXISTS listings_property_scraped_idx ON listings (property_id, scraped_at DESC)" "INDEX listings_property_scraped_idx"
Invoke-NeonSQL "CREATE INDEX IF NOT EXISTS listings_source_idx ON listings (source)"                                 "INDEX listings_source_idx"

# listing_snapshots
Invoke-NeonSQL @"
CREATE TABLE IF NOT EXISTS listing_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  price numeric(14, 2),
  captured_at timestamptz NOT NULL DEFAULT now()
)
"@ "TABLE listing_snapshots"

Invoke-NeonSQL "CREATE INDEX IF NOT EXISTS listing_snapshots_listing_idx ON listing_snapshots (listing_id, captured_at DESC)" "INDEX listing_snapshots_listing_idx"

# iptu_records
Invoke-NeonSQL @"
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
)
"@ "TABLE iptu_records"

Invoke-NeonSQL "CREATE INDEX IF NOT EXISTS iptu_records_property_idx ON iptu_records (property_id)" "INDEX iptu_records_property_idx"

# price_estimates
Invoke-NeonSQL @"
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
)
"@ "TABLE price_estimates"

Invoke-NeonSQL "CREATE INDEX IF NOT EXISTS price_estimates_property_idx ON price_estimates (property_id)"  "INDEX price_estimates_property_idx"
Invoke-NeonSQL "CREATE INDEX IF NOT EXISTS price_estimates_model_idx ON price_estimates (model_version)"   "INDEX price_estimates_model_idx"

# model_versions
Invoke-NeonSQL @"
CREATE TABLE IF NOT EXISTS model_versions (
  version text PRIMARY KEY,
  trained_at timestamptz,
  training_rows int,
  metrics jsonb,
  artifact_url text,
  active boolean NOT NULL DEFAULT false,
  notes text
)
"@ "TABLE model_versions"

Invoke-NeonSQL "CREATE INDEX IF NOT EXISTS model_versions_active_idx ON model_versions (active)" "INDEX model_versions_active_idx"

# scrape_errors
Invoke-NeonSQL @"
CREATE TABLE IF NOT EXISTS scrape_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text,
  url text,
  error text,
  occurred_at timestamptz NOT NULL DEFAULT now()
)
"@ "TABLE scrape_errors"

Invoke-NeonSQL "CREATE INDEX IF NOT EXISTS scrape_errors_source_idx ON scrape_errors (source, occurred_at DESC)" "INDEX scrape_errors_source_idx"

# iptu_fetch_errors
Invoke-NeonSQL @"
CREATE TABLE IF NOT EXISTS iptu_fetch_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid,
  adapter text,
  error text,
  occurred_at timestamptz NOT NULL DEFAULT now()
)
"@ "TABLE iptu_fetch_errors"

Invoke-NeonSQL "CREATE INDEX IF NOT EXISTS iptu_fetch_errors_adapter_idx ON iptu_fetch_errors (adapter, occurred_at DESC)" "INDEX iptu_fetch_errors_adapter_idx"

# opt_out_requests
Invoke-NeonSQL @"
CREATE TABLE IF NOT EXISTS opt_out_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  identifier text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  received_at timestamptz NOT NULL DEFAULT now()
)
"@ "TABLE opt_out_requests"

Invoke-NeonSQL "CREATE INDEX IF NOT EXISTS opt_out_requests_status_idx ON opt_out_requests (status)" "INDEX opt_out_requests_status_idx"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "✅  Migration aplicada com sucesso!" -ForegroundColor Green
Write-Host "   11 tabelas + indexes criados no banco neondb (branch main)" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
