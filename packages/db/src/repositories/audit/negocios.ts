/**
 * Repositório de negócios/vendas (módulo de auditoria, escopado por org).
 *
 * Contratos:
 *   - `upsertByVistaId` é idempotente por (org_id, vista_id).
 *   - `listClosedWithImovel` retorna negócios fechados desde `since` com o
 *     imóvel relacionado (left join — imóvel pode ser null).
 *   - Toda leitura é filtrada por org_id (isolamento multi-tenant).
 */
import { and, count, desc, eq, gte, isNotNull } from 'drizzle-orm';
import {
  auditImoveis,
  auditNegocios,
  type AuditImovel,
  type AuditNegocio,
  type NewAuditNegocio,
} from '../../schema-audit.js';
import type { AnyDbClient } from '../types.js';

/** Dados do negócio sem campos controlados pelo repositório. */
export type AuditNegocioData = Omit<NewAuditNegocio, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>;

export interface ListNegociosOpts {
  /** Apenas negócios com data_fechamento >= closedAfter. */
  closedAfter?: Date;
}

export interface NegocioComImovel {
  negocio: AuditNegocio;
  imovel: AuditImovel | null;
}

export interface ListNegociosPageOpts {
  limit?: number;
  offset?: number;
}

export interface CountNegociosOpts {
  /** Conta apenas negócios fechados (data_fechamento >= closedAfter). */
  closedAfter?: Date;
}

export interface AuditNegociosRepo {
  upsertByVistaId(db: AnyDbClient, orgId: string, data: AuditNegocioData): Promise<AuditNegocio>;
  listByOrg(db: AnyDbClient, orgId: string, opts?: ListNegociosOpts): Promise<AuditNegocio[]>;
  listClosedWithImovel(db: AnyDbClient, orgId: string, since: Date): Promise<NegocioComImovel[]>;
  /** Listagem paginada com o imóvel relacionado (dashboard), mais recentes primeiro. */
  listWithImovel(
    db: AnyDbClient,
    orgId: string,
    opts?: ListNegociosPageOpts,
  ): Promise<NegocioComImovel[]>;
  countByOrg(db: AnyDbClient, orgId: string, opts?: CountNegociosOpts): Promise<number>;
}

export const auditNegociosRepo: AuditNegociosRepo = {
  async upsertByVistaId(db, orgId, data) {
    const [row] = await db
      .insert(auditNegocios)
      .values({ ...data, orgId })
      .onConflictDoUpdate({
        target: [auditNegocios.orgId, auditNegocios.vistaId],
        set: {
          corretorId: data.corretorId ?? null,
          imovelId: data.imovelId ?? null,
          leadId: data.leadId ?? null,
          valorVenda: (data.valorVenda ?? null) as typeof auditNegocios.$inferInsert.valorVenda,
          comissaoPercentual: (data.comissaoPercentual ??
            null) as typeof auditNegocios.$inferInsert.comissaoPercentual,
          comissaoValor: (data.comissaoValor ??
            null) as typeof auditNegocios.$inferInsert.comissaoValor,
          dataFechamento: data.dataFechamento ?? null,
          dataEscritura: data.dataEscritura ?? null,
          status: data.status ?? null,
          observacoes: data.observacoes ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error('auditNegociosRepo.upsertByVistaId: insert sem retorno');
    return row;
  },

  async listByOrg(db, orgId, opts = {}) {
    const conditions = [eq(auditNegocios.orgId, orgId)];
    if (opts.closedAfter) conditions.push(gte(auditNegocios.dataFechamento, opts.closedAfter));
    return await db
      .select()
      .from(auditNegocios)
      .where(and(...conditions));
  },

  async listClosedWithImovel(db, orgId, since) {
    const rows = await db
      .select({ negocio: auditNegocios, imovel: auditImoveis })
      .from(auditNegocios)
      .leftJoin(auditImoveis, eq(auditNegocios.imovelId, auditImoveis.id))
      .where(
        and(
          eq(auditNegocios.orgId, orgId),
          isNotNull(auditNegocios.dataFechamento),
          gte(auditNegocios.dataFechamento, since),
        ),
      );
    return rows;
  },

  async listWithImovel(db, orgId, opts = {}) {
    return await db
      .select({ negocio: auditNegocios, imovel: auditImoveis })
      .from(auditNegocios)
      .leftJoin(auditImoveis, eq(auditNegocios.imovelId, auditImoveis.id))
      .where(eq(auditNegocios.orgId, orgId))
      .orderBy(desc(auditNegocios.createdAt))
      .limit(opts.limit ?? 100)
      .offset(opts.offset ?? 0);
  },

  async countByOrg(db, orgId, opts = {}) {
    const conditions = [eq(auditNegocios.orgId, orgId)];
    if (opts.closedAfter) {
      conditions.push(isNotNull(auditNegocios.dataFechamento));
      conditions.push(gte(auditNegocios.dataFechamento, opts.closedAfter));
    }
    const rows = await db
      .select({ total: count() })
      .from(auditNegocios)
      .where(and(...conditions));
    return rows[0]?.total ?? 0;
  },
};
