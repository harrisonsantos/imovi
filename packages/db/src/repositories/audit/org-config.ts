/**
 * Repositório da config Vista por organização (1 linha por org).
 *
 * `getByWebhookToken` resolve a org dona de um token de webhook —
 * usado pelo endpoint público de webhook do Vista para autenticar a chamada.
 */
import { eq } from 'drizzle-orm';
import { orgVistaConfig, type NewOrgVistaConfig, type OrgVistaConfig } from '../../schema-audit.js';
import type { AnyDbClient } from '../types.js';

/** Dados da config sem campos controlados pelo repositório. */
export type OrgVistaConfigData = Omit<
  NewOrgVistaConfig,
  'id' | 'orgId' | 'createdAt' | 'updatedAt'
>;

export interface OrgVistaConfigRepo {
  getByOrg(db: AnyDbClient, orgId: string): Promise<OrgVistaConfig | null>;
  getByWebhookToken(db: AnyDbClient, webhookToken: string): Promise<OrgVistaConfig | null>;
  upsert(db: AnyDbClient, orgId: string, data: OrgVistaConfigData): Promise<OrgVistaConfig>;
}

export const orgVistaConfigRepo: OrgVistaConfigRepo = {
  async getByOrg(db, orgId) {
    const rows = await db
      .select()
      .from(orgVistaConfig)
      .where(eq(orgVistaConfig.orgId, orgId))
      .limit(1);
    return rows[0] ?? null;
  },

  async getByWebhookToken(db, webhookToken) {
    const rows = await db
      .select()
      .from(orgVistaConfig)
      .where(eq(orgVistaConfig.webhookToken, webhookToken))
      .limit(1);
    return rows[0] ?? null;
  },

  async upsert(db, orgId, data) {
    const existing = await orgVistaConfigRepo.getByOrg(db, orgId);
    if (existing) {
      const [updated] = await db
        .update(orgVistaConfig)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(orgVistaConfig.orgId, orgId))
        .returning();
      if (!updated) throw new Error('orgVistaConfigRepo.upsert: update sem retorno');
      return updated;
    }
    const [inserted] = await db
      .insert(orgVistaConfig)
      .values({ ...data, orgId })
      .returning();
    if (!inserted) throw new Error('orgVistaConfigRepo.upsert: insert sem retorno');
    return inserted;
  },
};
