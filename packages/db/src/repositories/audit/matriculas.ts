/**
 * Repositório de matrículas (módulo de auditoria, escopado por org).
 *
 * Guarda apenas METADADOS do documento — o binário fica no R2 sob `r2Key`.
 * Contratos:
 *   - Toda leitura/escrita é filtrada por org_id (isolamento multi-tenant).
 *   - `setChecked` registra a verificação manual: grava `resultado` (jsonb)
 *     e carimba `checkedAt` com o horário atual.
 */
import { and, desc, eq } from 'drizzle-orm';
import {
  auditMatriculas,
  type AuditMatricula,
  type NewAuditMatricula,
} from '../../schema-audit.js';
import type { AnyDbClient } from '../types.js';

/** Dados da matrícula sem campos controlados pelo repositório. */
export type AuditMatriculaData = Omit<
  NewAuditMatricula,
  'id' | 'orgId' | 'checkedAt' | 'resultado' | 'createdAt'
>;

export interface ListMatriculasOpts {
  imovelId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditMatriculasRepo {
  insert(db: AnyDbClient, orgId: string, data: AuditMatriculaData): Promise<AuditMatricula>;
  /** Lista da org, mais recentes primeiro, com filtro opcional por imóvel. */
  listByOrg(db: AnyDbClient, orgId: string, opts?: ListMatriculasOpts): Promise<AuditMatricula[]>;
  findById(db: AnyDbClient, orgId: string, id: string): Promise<AuditMatricula | null>;
  /** Marca como verificada: grava `resultado` e `checkedAt = now()`. */
  setChecked(db: AnyDbClient, orgId: string, id: string, resultado: unknown): Promise<void>;
}

export const auditMatriculasRepo: AuditMatriculasRepo = {
  async insert(db, orgId, data) {
    const [row] = await db
      .insert(auditMatriculas)
      .values({ ...data, orgId })
      .returning();
    if (!row) throw new Error('auditMatriculasRepo.insert: insert sem retorno');
    return row;
  },

  async listByOrg(db, orgId, opts = {}) {
    const conditions = [eq(auditMatriculas.orgId, orgId)];
    if (opts.imovelId !== undefined) {
      conditions.push(eq(auditMatriculas.imovelId, opts.imovelId));
    }
    return await db
      .select()
      .from(auditMatriculas)
      .where(and(...conditions))
      .orderBy(desc(auditMatriculas.createdAt))
      .limit(opts.limit ?? 100)
      .offset(opts.offset ?? 0);
  },

  async findById(db, orgId, id) {
    const rows = await db
      .select()
      .from(auditMatriculas)
      .where(and(eq(auditMatriculas.orgId, orgId), eq(auditMatriculas.id, id)))
      .limit(1);
    return rows[0] ?? null;
  },

  async setChecked(db, orgId, id, resultado) {
    await db
      .update(auditMatriculas)
      .set({ checkedAt: new Date(), resultado })
      .where(and(eq(auditMatriculas.orgId, orgId), eq(auditMatriculas.id, id)));
  },
};
