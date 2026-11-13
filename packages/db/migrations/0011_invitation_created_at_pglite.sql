-- Better Auth 1.7.7 exige created_at na tabela invitations (plugin organization).
-- Aditiva e idempotente.
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
