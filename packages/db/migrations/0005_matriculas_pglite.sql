-- Matrículas de imóveis (módulo de auditoria): metadados dos documentos
-- enviados ao R2 (bucket MATRICULAS). O binário fica no R2; aqui só a
-- referência (r2_key) + auditoria do upload e da verificação manual.
--
-- org_id é text SEM foreign key, seguindo a convenção do módulo (0004):
-- o isolamento por org é garantido nos repositórios.

CREATE TABLE IF NOT EXISTS audit_matriculas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  imovel_id uuid NOT NULL REFERENCES audit_imoveis(id) ON DELETE CASCADE,
  r2_key text NOT NULL,
  file_name text NOT NULL,
  mime text NOT NULL,
  size integer NOT NULL,
  uploaded_by text,
  checked_at timestamptz,
  resultado jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_matriculas_org_imovel_idx ON audit_matriculas (org_id, imovel_id);
