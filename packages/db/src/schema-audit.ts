/**
 * Schema Drizzle do módulo de auditoria (portado do legado Supabase/imobcheck),
 * agora multi-tenant: toda tabela é escopada por `org_id`.
 *
 * IMPORTANTE — `org_id` é text SEM foreign key de propósito: a tabela
 * `organizations` é criada em outra migration (auth) e evitamos acoplamento
 * entre os dois módulos. O isolamento por org é garantido nos repositórios.
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const auditCorretores = pgTable(
  'audit_corretores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(),
    nome: text('nome').notNull(),
    email: text('email'),
    creci: text('creci'),
    vistaUserId: text('vista_user_id'),
    ativo: boolean('ativo').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgCreciUx: uniqueIndex('audit_corretores_org_creci_ux').on(t.orgId, t.creci),
    orgVistaUserUx: uniqueIndex('audit_corretores_org_vista_user_ux').on(t.orgId, t.vistaUserId),
    orgIdx: index('audit_corretores_org_idx').on(t.orgId),
  }),
);

export const auditImoveis = pgTable(
  'audit_imoveis',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(),
    vistaId: text('vista_id').notNull(),
    corretorId: uuid('corretor_id').references(() => auditCorretores.id),
    endereco: text('endereco'),
    tipo: text('tipo'),
    valor: numeric('valor', { precision: 14, scale: 2 }),
    matricula: text('matricula'),
    matriculaVerificada: boolean('matricula_verificada').default(false),
    status: text('status'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgVistaUx: uniqueIndex('audit_imoveis_org_vista_ux').on(t.orgId, t.vistaId),
    orgIdx: index('audit_imoveis_org_idx').on(t.orgId),
  }),
);

export const auditLeads = pgTable(
  'audit_leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(),
    vistaId: text('vista_id').notNull(),
    corretorId: uuid('corretor_id').references(() => auditCorretores.id),
    imovelId: uuid('imovel_id').references(() => auditImoveis.id),
    nome: text('nome'),
    email: text('email'),
    telefone: text('telefone'),
    origem: text('origem'),
    status: text('status'),
    valorProposta: numeric('valor_proposta', { precision: 14, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgVistaUx: uniqueIndex('audit_leads_org_vista_ux').on(t.orgId, t.vistaId),
    orgStatusIdx: index('audit_leads_org_status_idx').on(t.orgId, t.status),
  }),
);

export const auditNegocios = pgTable(
  'audit_negocios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(),
    vistaId: text('vista_id').notNull(),
    corretorId: uuid('corretor_id').references(() => auditCorretores.id),
    imovelId: uuid('imovel_id').references(() => auditImoveis.id),
    leadId: uuid('lead_id').references(() => auditLeads.id),
    valorVenda: numeric('valor_venda', { precision: 14, scale: 2 }),
    comissaoPercentual: numeric('comissao_percentual', { precision: 5, scale: 2 }),
    comissaoValor: numeric('comissao_valor', { precision: 14, scale: 2 }),
    dataFechamento: timestamp('data_fechamento', { withTimezone: true }),
    dataEscritura: timestamp('data_escritura', { withTimezone: true }),
    status: text('status'),
    observacoes: text('observacoes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgVistaUx: uniqueIndex('audit_negocios_org_vista_ux').on(t.orgId, t.vistaId),
    orgIdx: index('audit_negocios_org_idx').on(t.orgId),
  }),
);

export const auditAnomalias = pgTable(
  'audit_anomalias',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(),
    tipo: text('tipo').notNull(),
    severidade: text('severidade').notNull(),
    corretorId: uuid('corretor_id').references(() => auditCorretores.id),
    entidadeTipo: text('entidade_tipo'),
    entidadeId: text('entidade_id'),
    descricao: text('descricao'),
    dadosContexto: jsonb('dados_contexto'),
    resolvida: boolean('resolvida').default(false),
    resolvidaEm: timestamp('resolvida_em', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgResolvidaIdx: index('audit_anomalias_org_resolvida_idx').on(t.orgId, t.resolvida),
    orgTipoIdx: index('audit_anomalias_org_tipo_idx').on(t.orgId, t.tipo),
  }),
);

export const auditEventos = pgTable(
  'audit_eventos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(),
    tipo: text('tipo'),
    fonte: text('fonte'),
    corretorId: uuid('corretor_id').references(() => auditCorretores.id),
    dados: jsonb('dados'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgCreatedIdx: index('audit_eventos_org_created_idx').on(t.orgId, t.createdAt),
  }),
);

/**
 * Documentos de matrícula enviados ao R2 (bucket MATRICULAS). O binário fica
 * no R2 sob `r2_key`; aqui guardamos metadados + auditoria da verificação
 * manual (`checked_at`/`resultado`).
 */
export const auditMatriculas = pgTable(
  'audit_matriculas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(),
    imovelId: uuid('imovel_id')
      .notNull()
      .references(() => auditImoveis.id, { onDelete: 'cascade' }),
    r2Key: text('r2_key').notNull(),
    fileName: text('file_name').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    uploadedBy: text('uploaded_by'),
    checkedAt: timestamp('checked_at', { withTimezone: true }),
    resultado: jsonb('resultado'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgImovelIdx: index('audit_matriculas_org_imovel_idx').on(t.orgId, t.imovelId),
  }),
);

export const orgVistaConfig = pgTable('org_vista_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: text('org_id').notNull().unique(),
  vistaApiUrl: text('vista_api_url'),
  vistaApiKeyEnc: text('vista_api_key_enc'),
  webhookToken: text('webhook_token').notNull().unique(),
  /** Array de strings em jsonb (evita peculiaridades de array pg no pglite). */
  reportEmails: jsonb('report_emails').notNull().default([]),
  avmDeviationPct: integer('avm_deviation_pct').default(25),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AuditCorretor = typeof auditCorretores.$inferSelect;
export type NewAuditCorretor = typeof auditCorretores.$inferInsert;
export type AuditImovel = typeof auditImoveis.$inferSelect;
export type NewAuditImovel = typeof auditImoveis.$inferInsert;
export type AuditLead = typeof auditLeads.$inferSelect;
export type NewAuditLead = typeof auditLeads.$inferInsert;
export type AuditNegocio = typeof auditNegocios.$inferSelect;
export type NewAuditNegocio = typeof auditNegocios.$inferInsert;
export type AuditAnomalia = typeof auditAnomalias.$inferSelect;
export type NewAuditAnomalia = typeof auditAnomalias.$inferInsert;
export type AuditEvento = typeof auditEventos.$inferSelect;
export type NewAuditEvento = typeof auditEventos.$inferInsert;
export type AuditMatricula = typeof auditMatriculas.$inferSelect;
export type NewAuditMatricula = typeof auditMatriculas.$inferInsert;
export type OrgVistaConfig = typeof orgVistaConfig.$inferSelect;
export type NewOrgVistaConfig = typeof orgVistaConfig.$inferInsert;
