import { eq } from 'drizzle-orm';
import { billingEvents, organizations, type Organization } from '../schema-auth.js';
import type { AnyDbClient } from './types.js';

export interface BillingStateUpdate {
  organizationId?: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string | null;
  plan?: string;
  status?: string;
  maxCorretores?: number | null;
  subscriptionCurrentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}

export const billingRepo = {
  async findOrgByCustomer(db: AnyDbClient, customerId: string): Promise<Organization | null> {
    const rows = await db
      .select()
      .from(organizations)
      .where(eq(organizations.stripeCustomerId, customerId))
      .limit(1);
    return rows[0] ?? null;
  },

  async updateOrg(db: AnyDbClient, update: BillingStateUpdate): Promise<Organization | null> {
    const org = update.organizationId
      ? null
      : await this.findOrgByCustomer(db, update.stripeCustomerId);
    const id = update.organizationId ?? org?.id;
    if (!id) return null;

    const values: Partial<typeof organizations.$inferInsert> = {
      stripeCustomerId: update.stripeCustomerId,
      billingUpdatedAt: new Date(),
    };
    if (update.stripeSubscriptionId !== undefined) {
      values.stripeSubscriptionId = update.stripeSubscriptionId;
    }
    if (update.plan !== undefined) values.plan = update.plan;
    if (update.status !== undefined) values.status = update.status;
    if (update.maxCorretores !== undefined) values.maxCorretores = update.maxCorretores;
    if (update.subscriptionCurrentPeriodEnd !== undefined) {
      values.subscriptionCurrentPeriodEnd = update.subscriptionCurrentPeriodEnd;
    }
    if (update.cancelAtPeriodEnd !== undefined) {
      values.cancelAtPeriodEnd = update.cancelAtPeriodEnd;
    }

    const rows = await db
      .update(organizations)
      .set(values)
      .where(eq(organizations.id, id))
      .returning();
    return rows[0] ?? null;
  },

  async claimEvent(db: AnyDbClient, id: string, type: string): Promise<boolean> {
    const rows = await db
      .insert(billingEvents)
      .values({ id, type })
      .onConflictDoNothing()
      .returning({ id: billingEvents.id });
    return rows.length === 1;
  },

  async releaseEvent(db: AnyDbClient, id: string): Promise<void> {
    await db.delete(billingEvents).where(eq(billingEvents.id, id));
  },
};
