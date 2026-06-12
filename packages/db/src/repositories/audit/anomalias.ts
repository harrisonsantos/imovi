/**
 * Repositório de anomalias detectadas (módulo de auditoria, escopado por org).
 *
 * Contratos:
 *   - `insertMany` faz dedupe: pula a linha se já existe anomalia NÃO
 *     resolvida com a mesma (org_id, tipo, entidade_id). Após `resolve`,
 *     a mesma anomalia pode ser registrada de novo.
 *   - `resolve` é escopado por org: id de outra org não é afetado.
 */
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { auditAnomalias, type AuditAnomalia, type NewAuditAnomalia } from '../../schema-audit.js';
import type { AnyDbClient } from '../types.js';

/** Dados da anomalia sem campos controlados pelo repositório. */
export type AuditAnomaliaData = Omit<
  NewAuditAnomalia,
  'id' | 'orgId' | 'resolvida' | 'resolvidaEm' | 'createdAt'
>;

export interface ListAnomaliasOpts {
  resolvida?: boolean;
  tipo?: string;
  limit?: number;
  offset?: number;
  /** Ordenação por created_at; padrão 'asc' (comportamento original). */
  order?: 'asc' | 'desc';
}

/** Contagem de anomalias não resolvidas agrupada por severidade. */
export interface SeverityCount {
  severidade: string;
  total: number;
}

export interface AuditAnomaliasRepo {
  /** Insere as anomalias, pulando duplicatas não resolvidas. Retorna só as inseridas. */
  insertMany(db: AnyDbClient, orgId: string, rows: AuditAnomaliaData[]): Promise<AuditAnomalia[]>;
  listByOrg(db: AnyDbClient, orgId: string, opts?: ListAnomaliasOpts): Promise<AuditAnomalia[]>;
  countUnresolvedBySeverity(db: AnyDbClient, orgId: string): Promise<SeverityCount[]>;
  resolve(db: AnyDbClient, orgId: string, id: string): Promise<void>;
}

export const auditAnomaliasRepo: AuditAnomaliasRepo = {
  async insertMany(db, orgId, rows) {
    const inserted: AuditAnomalia[] = [];
    for (const row of rows) {
      // Dedupe: anomalia aberta com mesma (org, tipo, entidade_id) já existe?
      const dupes = await db
        .select({ id: auditAnomalias.id })
        .from(auditAnomalias)
        .where(
          and(
            eq(auditAnomalias.orgId, orgId),
            eq(auditAnomalias.tipo, row.tipo),
            row.entidadeId != null
              ? eq(auditAnomalias.entidadeId, row.entidadeId)
              : isNull(auditAnomalias.entidadeId),
            eq(auditAnomalias.resolvida, false),
          ),
        )
        .limit(1);
      if (dupes.length > 0) continue;

      const [r] = await db
        .insert(auditAnomalias)
        .values({ ...row, orgId })
        .returning();
      if (r) inserted.push(r);
    }
    return inserted;
  },

  async listByOrg(db, orgId, opts = {}) {
    const conditions = [eq(auditAnomalias.orgId, orgId)];
    if (opts.resolvida !== undefined) {
      conditions.push(eq(auditAnomalias.resolvida, opts.resolvida));
    }
    if (opts.tipo !== undefined) conditions.push(eq(auditAnomalias.tipo, opts.tipo));
    return await db
      .select()
      .from(auditAnomalias)
      .where(and(...conditions))
      .orderBy(
        opts.order === 'desc' ? desc(auditAnomalias.createdAt) : auditAnomalias.createdAt,
      )
      .limit(opts.limit ?? 100)
      .offset(opts.offset ?? 0);
  },

  async countUnresolvedBySeverity(db, orgId) {
    return await db
      .select({ severidade: auditAnomalias.severidade, total: count() })
      .from(auditAnomalias)
      .where(and(eq(auditAnomalias.orgId, orgId), eq(auditAnomalias.resolvida, false)))
      .groupBy(auditAnomalias.severidade);
  },

  async resolve(db, orgId, id) {
    await db
      .update(auditAnomalias)
      .set({ resolvida: true, resolvidaEm: new Date() })
      .where(and(eq(auditAnomalias.orgId, orgId), eq(auditAnomalias.id, id)));
  },
};
