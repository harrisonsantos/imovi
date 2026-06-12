/**
 * Repositório de leads (módulo de auditoria, escopado por org).
 *
 * Contratos:
 *   - `upsertByVistaId` é idempotente por (org_id, vista_id).
 *   - `listByOrg` aceita filtros de status e `updatedBefore` (leads "parados",
 *     usados na detecção de anomalias).
 *   - Toda leitura é filtrada por org_id (isolamento multi-tenant).
 */
import { and, count, eq, lt } from 'drizzle-orm';
import { auditLeads, type AuditLead, type NewAuditLead } from '../../schema-audit.js';
import type { AnyDbClient } from '../types.js';

/** Dados do lead sem campos controlados pelo repositório. */
export type AuditLeadData = Omit<NewAuditLead, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>;

export interface ListLeadsOpts {
  status?: string;
  /** Apenas leads com updated_at anterior a esta data. */
  updatedBefore?: Date;
}

export interface AuditLeadsRepo {
  upsertByVistaId(db: AnyDbClient, orgId: string, data: AuditLeadData): Promise<AuditLead>;
  listByOrg(db: AnyDbClient, orgId: string, opts?: ListLeadsOpts): Promise<AuditLead[]>;
  countByCorretor(db: AnyDbClient, orgId: string, corretorId: string): Promise<number>;
}

export const auditLeadsRepo: AuditLeadsRepo = {
  async upsertByVistaId(db, orgId, data) {
    const [row] = await db
      .insert(auditLeads)
      .values({ ...data, orgId })
      .onConflictDoUpdate({
        target: [auditLeads.orgId, auditLeads.vistaId],
        set: {
          corretorId: data.corretorId ?? null,
          imovelId: data.imovelId ?? null,
          nome: data.nome ?? null,
          email: data.email ?? null,
          telefone: data.telefone ?? null,
          origem: data.origem ?? null,
          status: data.status ?? null,
          valorProposta: (data.valorProposta ?? null) as typeof auditLeads.$inferInsert.valorProposta,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error('auditLeadsRepo.upsertByVistaId: insert sem retorno');
    return row;
  },

  async listByOrg(db, orgId, opts = {}) {
    const conditions = [eq(auditLeads.orgId, orgId)];
    if (opts.status !== undefined) conditions.push(eq(auditLeads.status, opts.status));
    if (opts.updatedBefore) conditions.push(lt(auditLeads.updatedAt, opts.updatedBefore));
    return await db
      .select()
      .from(auditLeads)
      .where(and(...conditions));
  },

  async countByCorretor(db, orgId, corretorId) {
    const rows = await db
      .select({ total: count() })
      .from(auditLeads)
      .where(and(eq(auditLeads.orgId, orgId), eq(auditLeads.corretorId, corretorId)));
    return rows[0]?.total ?? 0;
  },
};
