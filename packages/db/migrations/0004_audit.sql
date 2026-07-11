-- Módulo de auditoria (portado do legado imobcheck/Supabase), multi-tenant.
--
-- org_id é text SEM foreign key de propósito: a tabela organizations é criada
-- na migration de auth (paralela) e evitamos acoplamento entre módulos.
-- updated_at é mantido pela aplicação (repositórios), sem triggers.

CREATE TABLE IF NOT EXISTS audit_corretores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  nome text NOT NULL,
  email text,
  creci text,
  vista_user_id text,
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_corretores_org_creci_ux UNIQUE (org_id, creci),
  CONSTRAINT audit_corretores_org_vista_user_ux UNIQUE (org_id, vista_user_id)
);

CREATE INDEX IF NOT EXISTS audit_corretores_org_idx ON audit_corretores (org_id);

CREATE TABLE IF NOT EXISTS audit_imoveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  vista_id text NOT NULL,
  corretor_id uuid REFERENCES audit_corretores(id),
  endereco text,
  tipo text,
  valor numeric(14,2),
  matricula text,
  matricula_verificada boolean DEFAULT false,
  status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_imoveis_org_vista_ux UNIQUE (org_id, vista_id)
);

CREATE INDEX IF NOT EXISTS audit_imoveis_org_idx ON audit_imoveis (org_id);

CREATE TABLE IF NOT EXISTS audit_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  vista_id text NOT NULL,
  corretor_id uuid REFERENCES audit_corretores(id),
  imovel_id uuid REFERENCES audit_imoveis(id),
  nome text,
  email text,
  telefone text,
  origem text,
  status text,
  valor_proposta numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_leads_org_vista_ux UNIQUE (org_id, vista_id)
);

CREATE INDEX IF NOT EXISTS audit_leads_org_status_idx ON audit_leads (org_id, status);

CREATE TABLE IF NOT EXISTS audit_negocios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  vista_id text NOT NULL,
  corretor_id uuid REFERENCES audit_corretores(id),
  imovel_id uuid REFERENCES audit_imoveis(id),
  lead_id uuid REFERENCES audit_leads(id),
  valor_venda numeric(14,2),
  comissao_percentual numeric(5,2),
  comissao_valor numeric(14,2),
  data_fechamento timestamptz,
  data_escritura timestamptz,
  status text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_negocios_org_vista_ux UNIQUE (org_id, vista_id)
);

CREATE INDEX IF NOT EXISTS audit_negocios_org_idx ON audit_negocios (org_id);

CREATE TABLE IF NOT EXISTS audit_anomalias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  tipo text NOT NULL,
  severidade text NOT NULL,
  corretor_id uuid REFERENCES audit_corretores(id),
  entidade_tipo text,
  entidade_id text,
  descricao text,
  dados_contexto jsonb,
  resolvida boolean DEFAULT false,
  resolvida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_anomalias_org_resolvida_idx ON audit_anomalias (org_id, resolvida);
CREATE INDEX IF NOT EXISTS audit_anomalias_org_tipo_idx ON audit_anomalias (org_id, tipo);

CREATE TABLE IF NOT EXISTS audit_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  tipo text,
  fonte text,
  corretor_id uuid REFERENCES audit_corretores(id),
  dados jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_eventos_org_created_idx ON audit_eventos (org_id, created_at);

-- Config Vista por organização (1 linha por org).
-- report_emails: array de strings em jsonb (evita peculiaridades de array pg
-- no pglite).
CREATE TABLE IF NOT EXISTS org_vista_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL UNIQUE,
  vista_api_url text,
  vista_api_key_enc text,
  webhook_token text NOT NULL UNIQUE,
  report_emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  avm_deviation_pct integer DEFAULT 25,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
