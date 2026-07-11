/**
 * Repositório de imóveis (módulo de auditoria, escopado por org).
 *
 * Contratos:
 *   - `upsertByVistaId` é idempotente por (org_id, vista_id) e atualiza os
 *     campos vindos do Vista no conflito.
 *   - Toda leitura é filtrada por org_id (isolamento multi-tenant).
 */
import { and, eq } from 'drizzle-orm';
import { auditImoveis, type AuditImovel, type NewAuditImovel } from '../../schema-audit.js';
import type { AnyDbClient } from '../types.js';

/** Dados do imóvel sem campos controlados pelo repositório. */
export type AuditImovelData = Omit<NewAuditImovel, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>;

export interface ListImoveisOpts {
  status?: string;
}

export interface AuditImoveisRepo {
  upsertByVistaId(db: AnyDbClient, orgId: string, data: AuditImovelData): Promise<AuditImovel>;
  listByOrg(db: AnyDbClient, orgId: string, opts?: ListImoveisOpts): Promise<AuditImovel[]>;
  findByVistaId(db: AnyDbClient, orgId: string, vistaId: string): Promise<AuditImovel | null>;
  findById(db: AnyDbClient, orgId: string, id: string): Promise<AuditImovel | null>;
  /** Marca/desmarca o flag de matrícula verificada (fluxo de matrículas). */
  setMatriculaVerificada(
    db: AnyDbClient,
    orgId: string,
    id: string,
    verificada: boolean,
  ): Promise<void>;
}

export const auditImoveisRepo: AuditImoveisRepo = {
  async upsertByVistaId(db, orgId, data) {
    const [row] = await db
      .insert(auditImoveis)
      .values({ ...data, orgId })
      .onConflictDoUpdate({
        target: [auditImoveis.orgId, auditImoveis.vistaId],
        set: {
          corretorId: data.corretorId ?? null,
          endereco: data.endereco ?? null,
          tipo: data.tipo ?? null,
          valor: (data.valor ?? null) as typeof auditImoveis.$inferInsert.valor,
          matricula: data.matricula ?? null,
          matriculaVerificada: data.matriculaVerificada ?? false,
          status: data.status ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error('auditImoveisRepo.upsertByVistaId: insert sem retorno');
    return row;
  },

  async listByOrg(db, orgId, opts = {}) {
    const conditions = [eq(auditImoveis.orgId, orgId)];
    if (opts.status !== undefined) conditions.push(eq(auditImoveis.status, opts.status));
    return await db
      .select()
      .from(auditImoveis)
      .where(and(...conditions));
  },

  async findByVistaId(db, orgId, vistaId) {
    const rows = await db
      .select()
      .from(auditImoveis)
      .where(and(eq(auditImoveis.orgId, orgId), eq(auditImoveis.vistaId, vistaId)))
      .limit(1);
    return rows[0] ?? null;
  },

  async findById(db, orgId, id) {
    const rows = await db
      .select()
      .from(auditImoveis)
      .where(and(eq(auditImoveis.orgId, orgId), eq(auditImoveis.id, id)))
      .limit(1);
    return rows[0] ?? null;
  },

  async setMatriculaVerificada(db, orgId, id, verificada) {
    await db
      .update(auditImoveis)
      .set({ matriculaVerificada: verificada, updatedAt: new Date() })
      .where(and(eq(auditImoveis.orgId, orgId), eq(auditImoveis.id, id)));
  },
};
