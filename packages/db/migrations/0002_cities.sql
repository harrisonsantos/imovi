-- Cidades cobertas pelo Imovi (multi-cidade).
-- portal_locations: strings de location por portal, ex.:
--   {"zap": "pr+curitiba", "vivareal": "parana/curitiba", "olx": "pr/cidade-curitiba"}
CREATE TABLE IF NOT EXISTS cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  state char(2) NOT NULL,
  slug text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT false,
  centroid_lat double precision,
  centroid_lng double precision,
  portal_locations jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cities_name_state_ux UNIQUE (name, state)
);

CREATE INDEX IF NOT EXISTS cities_active_idx ON cities (active);
