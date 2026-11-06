import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
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
  checkoutToken?: string;
  expectedCheckoutToken?: string;
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

  async claimEvent(
    db: AnyDbClient,
    id: string,
    type: string,
    payload: Record<string, unknown>,
    leaseToken: string,
    now = new Date(),
  ): Promise<'claimed' | 'processed' | 'busy'> {
    await db
      .insert(billingEvents)
      .values({ id, type, payload, status: 'pending' })
      .onConflictDoNothing();
    const rows = await db
      .update(billingEvents)
      .set({
        status: 'processing',
        leaseToken,
        leaseExpiresAt: new Date(now.getTime() + 120_000),
        attempts: sql`${billingEvents.attempts} + 1`,
        lastError: null,
      })
      .where(
        and(
          eq(billingEvents.id, id),
          or(
            eq(billingEvents.status, 'pending'),
            and(eq(billingEvents.status, 'processing'), lt(billingEvents.leaseExpiresAt, now)),
          ),
        ),
      )
      .returning({ id: billingEvents.id });
    if (rows.length) return 'claimed';
    const [existing] = await db
      .select({ status: billingEvents.status })
      .from(billingEvents)
      .where(eq(billingEvents.id, id));
    return existing?.status === 'processed' ? 'processed' : 'busy';
  },

  async acquireOrgLease(
    db: AnyDbClient,
    organizationId: string,
    token: string,
    now = new Date(),
  ): Promise<Organization | null> {
    const rows = await db
      .update(organizations)
      .set({ billingLeaseToken: token, billingLeaseExpiresAt: new Date(now.getTime() + 120_000) })
      .where(
        and(
          eq(organizations.id, organizationId),
          or(isNull(organizations.billingLeaseToken), lt(organizations.billingLeaseExpiresAt, now)),
        ),
      )
      .returning();
    return rows[0] ?? null;
  },

  async beginCheckout(
    db: AnyDbClient,
    organizationId: string,
    leaseToken: string,
    checkoutToken: string,
    planId: string,
    expiresAt: Date,
    request: Record<string, string>,
  ): Promise<void> {
    const rows = await db
      .update(organizations)
      .set({
        billingCheckoutToken: checkoutToken,
        billingCheckoutPlanId: planId,
        billingCheckoutSessionId: null,
        billingCheckoutExpiresAt: expiresAt,
        billingCheckoutRequest: request,
      })
      .where(
        and(
          eq(organizations.id, organizationId),
          eq(organizations.billingLeaseToken, leaseToken),
          sql`${organizations.billingLeaseExpiresAt} > clock_timestamp()`,
        ),
      )
      .returning({ id: organizations.id });
    if (!rows.length) throw new Error('Billing lease lost');
  },

  async saveCheckoutSession(
    db: AnyDbClient,
    organizationId: string,
    leaseToken: string,
    checkoutToken: string,
    sessionId: string,
  ): Promise<void> {
    const rows = await db
      .update(organizations)
      .set({ billingCheckoutSessionId: sessionId })
      .where(
        and(
          eq(organizations.id, organizationId),
          eq(organizations.billingLeaseToken, leaseToken),
          eq(organizations.billingCheckoutToken, checkoutToken),
          sql`${organizations.billingLeaseExpiresAt} > clock_timestamp()`,
        ),
      )
      .returning({ id: organizations.id });
    if (!rows.length) throw new Error('Billing lease lost');
  },

  async releaseOrgLease(db: AnyDbClient, organizationId: string, token: string): Promise<void> {
    await db
      .update(organizations)
      .set({ billingLeaseToken: null, billingLeaseExpiresAt: null })
      .where(and(eq(organizations.id, organizationId), eq(organizations.billingLeaseToken, token)));
  },

  // A single SQL statement makes the state update and inbox completion atomic on neon-http.
  // Both leases fence workers that resume after their lease has expired.
  // Callers reconcile from a fresh Stripe read under the org lease. Delivery timestamps
  // are an audit watermark, not an entitlement gate: a delayed event can reveal cancellation.
  async completeEvent(
    db: AnyDbClient,
    id: string,
    token: string,
    update?: BillingStateUpdate,
    createdAt = new Date(),
  ): Promise<void> {
    if (!update) {
      const rows = await db
        .update(billingEvents)
        .set({
          status: 'processed',
          processedAt: new Date(),
          leaseToken: null,
          leaseExpiresAt: null,
        })
        .where(
          and(
            eq(billingEvents.id, id),
            eq(billingEvents.leaseToken, token),
            eq(billingEvents.status, 'processing'),
            sql`${billingEvents.leaseExpiresAt} > clock_timestamp()`,
          ),
        )
        .returning({ id: billingEvents.id });
      if (!rows.length) throw new Error('Billing lease lost');
      return;
    }
    const result = await db.execute(sql`
      WITH locked AS (
        SELECT id FROM billing_events WHERE id = ${id} AND lease_token = ${token}
          AND status = 'processing' AND lease_expires_at > clock_timestamp() FOR UPDATE
      ), updated AS (
        UPDATE organizations SET
          stripe_customer_id = ${update.stripeCustomerId},
          stripe_subscription_id = CASE WHEN ${update.stripeSubscriptionId !== undefined}::boolean THEN ${update.stripeSubscriptionId ?? null}::text ELSE stripe_subscription_id END,
          plan = COALESCE(${update.plan ?? null}::text, plan),
          status = COALESCE(${update.status ?? null}::text, status),
          max_corretores = CASE WHEN ${update.maxCorretores !== undefined}::boolean THEN ${update.maxCorretores ?? null}::integer ELSE max_corretores END,
          subscription_current_period_end = CASE WHEN ${update.subscriptionCurrentPeriodEnd !== undefined}::boolean THEN ${update.subscriptionCurrentPeriodEnd?.toISOString() ?? null}::timestamptz ELSE subscription_current_period_end END,
          cancel_at_period_end = CASE WHEN ${update.cancelAtPeriodEnd !== undefined}::boolean THEN ${update.cancelAtPeriodEnd ?? false}::boolean ELSE cancel_at_period_end END,
          billing_updated_at = now(), billing_last_event_created_at = GREATEST(billing_last_event_created_at, ${createdAt.toISOString()}::timestamptz),
          billing_lease_token = NULL, billing_lease_expires_at = NULL,
          billing_checkout_token = CASE WHEN billing_checkout_token = ${update.checkoutToken ?? null}::text THEN NULL ELSE billing_checkout_token END,
          billing_checkout_plan_id = CASE WHEN billing_checkout_token = ${update.checkoutToken ?? null}::text THEN NULL ELSE billing_checkout_plan_id END,
          billing_checkout_session_id = CASE WHEN billing_checkout_token = ${update.checkoutToken ?? null}::text THEN NULL ELSE billing_checkout_session_id END,
          billing_checkout_expires_at = CASE WHEN billing_checkout_token = ${update.checkoutToken ?? null}::text THEN NULL ELSE billing_checkout_expires_at END,
          billing_checkout_request = CASE WHEN billing_checkout_token = ${update.checkoutToken ?? null}::text THEN NULL ELSE billing_checkout_request END
        WHERE id = ${update.organizationId} AND billing_lease_token = ${token}
          AND billing_lease_expires_at > clock_timestamp() AND EXISTS (SELECT 1 FROM locked)
          AND (${update.expectedCheckoutToken ?? null}::text IS NULL OR billing_checkout_token = ${update.expectedCheckoutToken ?? null}::text)
        RETURNING id
      )
      UPDATE billing_events SET status = 'processed', processed_at = now(), lease_token = NULL, lease_expires_at = NULL
      WHERE id = ${id} AND EXISTS (SELECT 1 FROM updated) RETURNING id
    `);
    const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows;
    if (!rows?.length) throw new Error('Billing lease lost');
  },

  async releaseEvent(
    db: AnyDbClient,
    id: string,
    token: string,
    organizationId?: string,
  ): Promise<void> {
    // Never delete inbox evidence, and never release a lease acquired by a newer worker.
    await db
      .update(billingEvents)
      .set({
        status: 'pending',
        leaseToken: null,
        leaseExpiresAt: null,
        lastError: 'reconciliation_failed',
      })
      .where(and(eq(billingEvents.id, id), eq(billingEvents.leaseToken, token)));
    if (organizationId)
      await db
        .update(organizations)
        .set({ billingLeaseToken: null, billingLeaseExpiresAt: null })
        .where(
          and(eq(organizations.id, organizationId), eq(organizations.billingLeaseToken, token)),
        );
  },
};
