import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { billingRepo } from '../src/repositories/billing.js';
import { memberRepo } from '../src/repositories/members.js';
import { billingEvents, members, organizations, users } from '../src/schema-auth.js';
import { createTestDb, type TestDb } from './setup.js';

describe('billing inbox and live organization membership', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
    await t.db.insert(organizations).values([
      { id: 'a', name: 'A', maxCorretores: 5 },
      { id: 'b', name: 'B' },
    ]);
  });
  afterEach(async () => {
    await t?.dispose();
  });

  it('checks the requested organization and revokes removed members', async () => {
    await t.db.insert(users).values({ id: 'u', name: 'User', email: 'u@example.com' });
    await t.db.insert(members).values({ id: 'm', userId: 'u', organizationId: 'a', role: 'owner' });
    expect((await memberRepo.findByUserAndOrg(t.db, 'u', 'a'))?.role).toBe('owner');
    expect(await memberRepo.findByUserAndOrg(t.db, 'u', 'b')).toBeNull();
    await t.db.delete(members).where(eq(members.id, 'm'));
    expect(await memberRepo.findByUserAndOrg(t.db, 'u', 'a')).toBeNull();
  });

  it('retries pending events and atomically finishes state with the inbox', async () => {
    await t.db
      .update(organizations)
      .set({ subscriptionCurrentPeriodEnd: new Date('2026-10-10') })
      .where(eq(organizations.id, 'a'));
    expect(await billingRepo.claimEvent(t.db, 'e', 'invoice.paid', {}, 'one')).toBe('claimed');
    expect(await billingRepo.claimEvent(t.db, 'e', 'invoice.paid', {}, 'two')).toBe('busy');
    await billingRepo.acquireOrgLease(t.db, 'a', 'one');
    expect(await billingRepo.acquireOrgLease(t.db, 'a', 'two')).toBeNull();
    await billingRepo.releaseEvent(t.db, 'e', 'one', 'a');
    expect(await billingRepo.claimEvent(t.db, 'e', 'invoice.paid', {}, 'two')).toBe('claimed');
    await billingRepo.acquireOrgLease(t.db, 'a', 'two');
    await billingRepo.completeEvent(
      t.db,
      'e',
      'two',
      {
        organizationId: 'a',
        stripeCustomerId: 'cus_a',
        stripeSubscriptionId: 'sub_a',
        status: 'suspended',
      },
      new Date('2026-09-01'),
    );
    const [org] = await t.db.select().from(organizations).where(eq(organizations.id, 'a'));
    const [event] = await t.db.select().from(billingEvents).where(eq(billingEvents.id, 'e'));
    expect(org?.status).toBe('suspended');
    expect(org?.maxCorretores).toBe(5);
    expect(org?.subscriptionCurrentPeriodEnd).toEqual(new Date('2026-10-10'));
    expect(org?.billingLeaseToken).toBeNull();
    expect(event?.status).toBe('processed');
    expect(event?.processedAt).not.toBeNull();
    expect(event?.attempts).toBe(2);
    expect(await billingRepo.claimEvent(t.db, 'e', 'invoice.paid', {}, 'three')).toBe('processed');
  });

  it('prevents an expired worker from overwriting state or finishing a replacement lease', async () => {
    const expired = new Date(Date.now() - 180_000);
    await billingRepo.claimEvent(t.db, 'e', 'invoice.paid', {}, 'old', expired);
    await billingRepo.acquireOrgLease(t.db, 'a', 'old', expired);
    expect(await billingRepo.claimEvent(t.db, 'e', 'invoice.paid', {}, 'new')).toBe('claimed');
    await billingRepo.acquireOrgLease(t.db, 'a', 'new');
    await expect(
      billingRepo.completeEvent(t.db, 'e', 'old', {
        organizationId: 'a',
        stripeCustomerId: 'cus_a',
        status: 'active',
      }),
    ).rejects.toThrow('lease lost');
    await billingRepo.releaseEvent(t.db, 'e', 'old', 'a');
    const [event] = await t.db.select().from(billingEvents).where(eq(billingEvents.id, 'e'));
    expect(event?.leaseToken).toBe('new');
    await billingRepo.completeEvent(t.db, 'e', 'new', {
      organizationId: 'a',
      stripeCustomerId: 'cus_a',
      status: 'suspended',
    });
  });

  it('applies the freshly retrieved Stripe status even when an older delivery triggers reconciliation', async () => {
    await t.db
      .update(organizations)
      .set({ status: 'active', billingLastEventCreatedAt: new Date('2026-09-10') })
      .where(eq(organizations.id, 'a'));
    await billingRepo.claimEvent(t.db, 'old', 'invoice.paid', {}, 'token');
    await billingRepo.acquireOrgLease(t.db, 'a', 'token');
    await billingRepo.completeEvent(
      t.db,
      'old',
      'token',
      { organizationId: 'a', stripeCustomerId: 'cus_a', status: 'suspended' },
      new Date('2026-09-01'),
    );
    const [org] = await t.db.select().from(organizations).where(eq(organizations.id, 'a'));
    const [event] = await t.db.select().from(billingEvents).where(eq(billingEvents.id, 'old'));
    expect(org?.status).toBe('suspended');
    expect(org?.billingLastEventCreatedAt).toEqual(new Date('2026-09-10'));
    expect(org?.billingLeaseToken).toBeNull();
    expect(event?.status).toBe('processed');
  });

  it('persists a checkout attempt across lease expiry and fences the interrupted worker', async () => {
    const params = {
      mode: 'subscription',
      'line_items[0][price]': 'price_original',
      'metadata[checkout_token]': 'attempt',
    };
    const expiry = new Date(Date.now() + 3_600_000);
    await billingRepo.acquireOrgLease(t.db, 'a', 'old');
    await billingRepo.beginCheckout(t.db, 'a', 'old', 'attempt', 'audit-essencial', expiry, params);
    await t.db
      .update(organizations)
      .set({ billingLeaseExpiresAt: new Date(Date.now() - 1_000) })
      .where(eq(organizations.id, 'a'));
    const resumed = await billingRepo.acquireOrgLease(t.db, 'a', 'new');
    expect(resumed?.billingCheckoutToken).toBe('attempt');
    expect(resumed?.billingCheckoutExpiresAt).toEqual(expiry);
    expect(resumed?.billingCheckoutRequest).toEqual(params);
    await expect(
      billingRepo.beginCheckout(t.db, 'a', 'old', 'stale_attempt', 'audit-essencial', expiry, {}),
    ).rejects.toThrow('lease lost');
    await expect(
      billingRepo.saveCheckoutSession(t.db, 'a', 'old', 'attempt', 'cs_stale'),
    ).rejects.toThrow('lease lost');
    await billingRepo.releaseOrgLease(t.db, 'a', 'old');
    await billingRepo.saveCheckoutSession(t.db, 'a', 'new', 'attempt', 'cs_saved');
    await billingRepo.releaseOrgLease(t.db, 'a', 'new');
    const [stored] = await t.db.select().from(organizations).where(eq(organizations.id, 'a'));
    expect(stored?.billingCheckoutSessionId).toBe('cs_saved');
    expect(stored?.billingCheckoutRequest).toEqual(params);
  });

  it('does not attach a stale session to a replacement checkout token', async () => {
    await billingRepo.acquireOrgLease(t.db, 'a', 'owner');
    const expiry = new Date(Date.now() + 3_600_000);
    await billingRepo.beginCheckout(
      t.db,
      'a',
      'owner',
      'new_attempt',
      'audit-essencial',
      expiry,
      {},
    );
    await expect(
      billingRepo.saveCheckoutSession(t.db, 'a', 'owner', 'old_attempt', 'cs_old'),
    ).rejects.toThrow('lease lost');
    const [stored] = await t.db.select().from(organizations).where(eq(organizations.id, 'a'));
    expect(stored?.billingCheckoutSessionId).toBeNull();
    expect(stored?.billingCheckoutToken).toBe('new_attempt');
  });

  it('allows only one checkout lease under concurrent requests', async () => {
    const claims = await Promise.all([
      billingRepo.acquireOrgLease(t.db, 'a', 'first'),
      billingRepo.acquireOrgLease(t.db, 'a', 'second'),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it('cannot finish an event for a checkout token that has been replaced', async () => {
    await t.db
      .update(organizations)
      .set({ billingCheckoutToken: 'new_attempt' })
      .where(eq(organizations.id, 'a'));
    await billingRepo.claimEvent(
      t.db,
      'stale_checkout',
      'checkout.session.completed',
      {},
      'worker',
    );
    await billingRepo.acquireOrgLease(t.db, 'a', 'worker');
    await expect(
      billingRepo.completeEvent(t.db, 'stale_checkout', 'worker', {
        organizationId: 'a',
        stripeCustomerId: 'cus_a',
        stripeSubscriptionId: 'sub_old',
        status: 'active',
        expectedCheckoutToken: 'old_attempt',
        checkoutToken: 'old_attempt',
      }),
    ).rejects.toThrow('lease lost');
    const [stored] = await t.db.select().from(organizations).where(eq(organizations.id, 'a'));
    const [event] = await t.db
      .select()
      .from(billingEvents)
      .where(eq(billingEvents.id, 'stale_checkout'));
    expect(stored?.billingCheckoutToken).toBe('new_attempt');
    expect(stored?.stripeSubscriptionId).toBeNull();
    expect(event?.status).toBe('processing');
  });
  it('only one concurrent delivery can acquire the same event', async () => {
    const claims = await Promise.all([
      billingRepo.claimEvent(t.db, 'race', 'invoice.paid', {}, 'first'),
      billingRepo.claimEvent(t.db, 'race', 'invoice.paid', {}, 'second'),
    ]);
    expect(claims.filter((claim) => claim === 'claimed')).toHaveLength(1);
    expect(claims.filter((claim) => claim === 'busy')).toHaveLength(1);
  });

  it('rolls back inbox completion when the organization update fails', async () => {
    await t.db
      .update(organizations)
      .set({ stripeCustomerId: 'cus_duplicate' })
      .where(eq(organizations.id, 'b'));
    await billingRepo.claimEvent(t.db, 'failure', 'invoice.paid', {}, 'token');
    await billingRepo.acquireOrgLease(t.db, 'a', 'token');
    await expect(
      billingRepo.completeEvent(t.db, 'failure', 'token', {
        organizationId: 'a',
        stripeCustomerId: 'cus_duplicate',
        status: 'active',
      }),
    ).rejects.toThrow();
    const [org] = await t.db.select().from(organizations).where(eq(organizations.id, 'a'));
    const [event] = await t.db.select().from(billingEvents).where(eq(billingEvents.id, 'failure'));
    expect(org?.status).toBe('trial');
    expect(event?.status).toBe('processing');
    expect(event?.processedAt).toBeNull();
    await billingRepo.releaseEvent(t.db, 'failure', 'token', 'a');
    expect(await billingRepo.claimEvent(t.db, 'failure', 'invoice.paid', {}, 'retry')).toBe(
      'claimed',
    );
  });

  it('accepts a verified replacement subscription when older checkout delivery follows newer old-sub events', async () => {
    await t.db
      .update(organizations)
      .set({
        status: 'active',
        stripeSubscriptionId: 'sub_old',
        billingCheckoutToken: 'attempt_new',
        billingCheckoutPlanId: 'audit-essencial',
        billingCheckoutSessionId: 'cs_new',
        billingCheckoutExpiresAt: new Date(Date.now() + 3_600_000),
        billingCheckoutRequest: { mode: 'subscription' },
        billingLastEventCreatedAt: new Date('2026-09-10'),
      })
      .where(eq(organizations.id, 'a'));
    await billingRepo.claimEvent(t.db, 'replacement', 'checkout.session.completed', {}, 'token');
    await billingRepo.acquireOrgLease(t.db, 'a', 'token');
    await billingRepo.completeEvent(
      t.db,
      'replacement',
      'token',
      {
        organizationId: 'a',
        stripeCustomerId: 'cus_a',
        stripeSubscriptionId: 'sub_new',
        status: 'active',
        expectedCheckoutToken: 'attempt_new',
        checkoutToken: 'attempt_new',
      },
      new Date('2026-09-09'),
    );
    const [org] = await t.db.select().from(organizations).where(eq(organizations.id, 'a'));
    expect(org?.stripeSubscriptionId).toBe('sub_new');
    expect(org?.status).toBe('active');
    expect(org?.billingLastEventCreatedAt).toEqual(new Date('2026-09-10'));
    expect(org?.billingCheckoutToken).toBeNull();
    expect(org?.billingCheckoutPlanId).toBeNull();
    expect(org?.billingCheckoutSessionId).toBeNull();
    expect(org?.billingCheckoutExpiresAt).toBeNull();
    expect(org?.billingCheckoutRequest).toBeNull();
  });
});
