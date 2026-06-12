/**
 * Repositório de corretores (módulo de auditoria, escopado por org).
 *
 * Contratos:
 *   - Upserts idempotentes por (org_id, vista_user_id) e (org_id, creci).
 *   - Toda leitura é filtrada por org_id (isolamento multi-tenant).
 */
import { and, count, eq } from 'drizzle-orm';
import {
  auditCorretores,
  type AuditCorretor,
  type NewAuditCorretor,
} from '../../schema-audit.js';
import type { AnyDbClient } from '../types.js';

/** Dados do corretor sem campos controlados pelo repositório. */
export type AuditCorretorData = Omit<NewAuditCorretor, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>;

export interface AuditCorretoresRepo {
  upsertByVistaUserId(
    db: AnyDbClient,
    orgId: string,
    data: AuditCorretorData & { vistaUserId: string },
  ): Promise<AuditCorretor>;
  upsertByCreci(
    db: AnyDbClient,
    orgId: string,
    data: AuditCorretorData & { creci: string },
  ): Promise<AuditCorretor>;
  listByOrg(db: AnyDbClient, orgId: string): Promise<AuditCorretor[]>;
  countActive(db: AnyDbClient, orgId: string): Promise<number>;
  findById(db: AnyDbClient, orgId: string, id: string): Promise<AuditCorretor | null>;
}

export const auditCorretoresRepo: AuditCorretoresRepo = {
  async upsertByVistaUserId(db, orgId, data) {
    const [row] = await db
      .insert(auditCorretores)
      .values({ ...data, orgId })
      .onConflictDoUpdate({
        target: [auditCorretores.orgId, auditCorretores.vistaUserId],
        set: {
          nome: data.nome,
          email: data.email ?? null,
          creci: data.creci ?? null,
          ativo: data.ativo ?? true,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error('auditCorretoresRepo.upsertByVistaUserId: insert sem retorno');
    return row;
  },

  async upsertByCreci(db, orgId, data) {
    const [row] = await db
      .insert(auditCorretores)
      .values({ ...data, orgId })
      .onConflictDoUpdate({
        target: [auditCorretores.orgId, auditCorretores.creci],
        set: {
          nome: data.nome,
          email: data.email ?? null,
          vistaUserId: data.vistaUserId ?? null,
          ativo: data.ativo ?? true,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error('auditCorretoresRepo.upsertByCreci: insert sem retorno');
    return row;
  },

  async listByOrg(db, orgId) {
    return await db
      .select()
      .from(auditCorretores)
      .where(eq(auditCorretores.orgId, orgId))
      .orderBy(auditCorretores.nome);
  },

  async countActive(db, orgId) {
    const rows = await db
      .select({ total: count() })
      .from(auditCorretores)
      .where(and(eq(auditCorretores.orgId, orgId), eq(auditCorretores.ativo, true)));
    return rows[0]?.total ?? 0;
  },

  async findById(db, orgId, id) {
    const rows = await db
      .select()
      .from(auditCorretores)
      .where(and(eq(auditCorretores.orgId, orgId), eq(auditCorretores.id, id)))
      .limit(1);
    return rows[0] ?? null;
  },
};
