-- Trilha de aceite dos Termos de uso e da Política de privacidade.
-- Aditiva e idempotente. Um registro por usuário e versão dos termos; nova
-- versão gera novo registro, preservando o histórico de aceites anteriores.
-- RESTRICT: a conta não pode ser excluída enquanto houver aceite registrado;
-- a Política de privacidade promete guardar a trilha pelo prazo prescricional.
CREATE TABLE IF NOT EXISTS terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  source text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS terms_acceptances_user_version_ux
  ON terms_acceptances (user_id, terms_version);
