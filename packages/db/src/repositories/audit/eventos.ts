/**
 * Repositório de eventos/log de auditoria (escopado por org).
 *
 * Append-only: `record` insere, `listByOrg` retorna os mais recentes primeiro.
 */
import { desc, eq } from 'drizzle-orm';
import { auditEventos, type AuditEvento, type NewAuditEvento } from '../../schema-audit.js';
import type { AnyDbClient } from '../types.js';

/** Dados do evento sem campos controlados pelo repositório. */
export type AuditEventoData = Omit<NewAuditEvento, 'id' | 'orgId' | 'createdAt'>;

export interface AuditEventosRepo {
  record(db: AnyDbClient, orgId: string, evento: AuditEventoData): Promise<AuditEvento>;
  listByOrg(db: AnyDbClient, orgId: string, limit?: number): Promise<AuditEvento[]>;
}

export const auditEventosRepo: AuditEventosRepo = {
  async record(db, orgId, evento) {
    const [row] = await db
      .insert(auditEventos)
      .values({ ...evento, orgId })
      .returning();
    if (!row) throw new Error('auditEventosRepo.record: insert sem retorno');
    return row;
  },

  async listByOrg(db, orgId, limit = 100) {
    return await db
      .select()
      .from(auditEventos)
      .where(eq(auditEventos.orgId, orgId))
      .orderBy(desc(auditEventos.createdAt))
      .limit(limit);
  },
};
