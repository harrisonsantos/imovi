/**
 * Repositório de organizations (imobiliárias) — better-auth + campos de
 * negócio. Mantém as queries dentro do pacote para evitar instâncias
 * duplicadas de drizzle-orm nos apps edge.
 */
import { and, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { organizations, type Organization } from '../schema-auth.js';
import type { AnyDbClient } from './types.js';

export interface OrgRepo {
  findById(db: AnyDbClient, id: string): Promise<Organization | null>;
  /** Active/past_due e trials sem prazo ou ainda não expirados. */
  listActiveForAudit(db: AnyDbClient): Promise<Organization[]>;
  setTrialEndsAt(db: AnyDbClient, id: string, trialEndsAt: Date): Promise<void>;
  setStatus(db: AnyDbClient, id: string, status: string): Promise<void>;
}

export const orgRepo: OrgRepo = {
  async findById(db, id) {
    const rows = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async listActiveForAudit(db) {
    return await db
      .select()
      .from(organizations)
      .where(
        or(
          inArray(organizations.status, ['active', 'past_due']),
          and(
            eq(organizations.status, 'trial'),
            or(isNull(organizations.trialEndsAt), gt(organizations.trialEndsAt, sql`NOW()`)),
          ),
        ),
      );
  },

  async setTrialEndsAt(db, id, trialEndsAt) {
    await db.update(organizations).set({ trialEndsAt }).where(eq(organizations.id, id));
  },

  async setStatus(db, id, status) {
    await db.update(organizations).set({ status }).where(eq(organizations.id, id));
  },
};
