/**
 * Repositório de organizations (imobiliárias) — better-auth + campos de
 * negócio. Mantém as queries dentro do pacote para evitar instâncias
 * duplicadas de drizzle-orm nos apps edge.
 */
import { eq } from 'drizzle-orm';
import { organizations, type Organization } from '../schema-auth.js';
import type { AnyDbClient } from './types.js';

export interface OrgRepo {
  findById(db: AnyDbClient, id: string): Promise<Organization | null>;
  setTrialEndsAt(db: AnyDbClient, id: string, trialEndsAt: Date): Promise<void>;
  setStatus(db: AnyDbClient, id: string, status: string): Promise<void>;
}

export const orgRepo: OrgRepo = {
  async findById(db, id) {
    const rows = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return rows[0] ?? null;
  },

  async setTrialEndsAt(db, id, trialEndsAt) {
    await db.update(organizations).set({ trialEndsAt }).where(eq(organizations.id, id));
  },

  async setStatus(db, id, status) {
    await db.update(organizations).set({ status }).where(eq(organizations.id, id));
  },
};
