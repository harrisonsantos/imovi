import type * as sessionModule from '../src/lib/session';
import type * as stripeModule from '../src/lib/stripe-edge';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  claimEvent: vi.fn(),
  completeEvent: vi.fn(),
  releaseEvent: vi.fn(),
  acquireOrgLease: vi.fn(),
  findOrgByCustomer: vi.fn(),
  findById: vi.fn(),
  retrieveSubscription: vi.fn(),
  requireOrgAdminIdentity: vi.fn(),
  requireOrgAdmin: vi.fn(),
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  beginCheckout: vi.fn(),
  saveCheckoutSession: vi.fn(),
  releaseOrgLease: vi.fn(),
  retrieveCheckoutSession: vi.fn(),
}));
vi.mock('@/lib/cf-env', () => ({
  getCfEnv: async () => ({
    STRIPE_SECRET_KEY: 'sk_test_fixture',
    STRIPE_WEBHOOK_SECRET: 'fixture-secret',
    NEXT_PUBLIC_APP_URL: 'https://imovi.test',
    STRIPE_PRICE_AUDIT_ESSENCIAL: 'price_fixture',
    STRIPE_PRICE_AUDIT_PROFISSIONAL: 'price_professional',
  }),
  authEnvOf: () => ({}),
}));
vi.mock('@imovi/db/audit', () => ({ orgVistaConfigRepo: { getByOrg: vi.fn(), upsert: vi.fn() } }));
vi.mock('@/lib/db', () => ({ getDb: () => ({}) }));
vi.mock('@imovi/db/billing', () => ({ billingRepo: mocks }));
vi.mock('@imovi/db/orgs', () => ({ orgRepo: { findById: mocks.findById } }));
vi.mock('@/lib/stripe-edge', async (original) => ({
  ...(await original<typeof stripeModule>()),
  retrieveSubscription: mocks.retrieveSubscription,
  retrieveCheckoutSession: mocks.retrieveCheckoutSession,
  createCheckoutSession: mocks.createCheckoutSession,
  createPortalSession: mocks.createPortalSession,
}));
vi.mock('@/lib/session', async (original) => ({
  ...(await original<typeof sessionModule>()),
  requireOrgAdminIdentity: mocks.requireOrgAdminIdentity,
  requireOrgAdmin: mocks.requireOrgAdmin,
}));
import { SessionError } from '../src/lib/session';
import { POST as webhook } from '../src/app/api/billing/webhook/route';
import { POST as checkout } from '../src/app/api/billing/checkout/route';
import { GET as configGet, PUT as configPut } from '../src/app/api/auditoria/config/route';
import { POST as portal } from '../src/app/api/billing/portal/route';
const org = {
  id: 'org',
  stripeCustomerId: 'cus_org',
  stripeSubscriptionId: 'sub_org',
  status: 'active',
};
async function eventRequest(type: string, extra: Record<string, unknown> = {}) {
  const payload = JSON.stringify({
    id: 'evt_fixture',
    type,
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: 'sub_org', customer: 'cus_org', subscription: 'sub_org', ...extra } },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('fixture-secret'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
  return new Request('https://imovi.test/api/billing/webhook', {
    method: 'POST',
    body: payload,
    headers: { 'stripe-signature': `t=${timestamp},v1=${hex}` },
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.claimEvent.mockResolvedValue('claimed');
  mocks.findOrgByCustomer.mockResolvedValue(org);
  mocks.findById.mockResolvedValue(org);
  mocks.acquireOrgLease.mockResolvedValue(org);
  mocks.completeEvent.mockResolvedValue(undefined);
  mocks.releaseEvent.mockResolvedValue(undefined);
  mocks.releaseOrgLease.mockResolvedValue(undefined);
  mocks.beginCheckout.mockResolvedValue(undefined);
  mocks.saveCheckoutSession.mockResolvedValue(undefined);
  mocks.requireOrgAdminIdentity.mockResolvedValue({ org, email: 'owner@imovi.test' });
  mocks.retrieveSubscription.mockResolvedValue({
    id: 'sub_org',
    customer: 'cus_org',
    status: 'canceled',
    metadata: { organization_id: 'org', plan_id: 'audit-essencial' },
    items: { data: [{ price: { id: 'price_fixture' } }] },
  });
});
describe('billing webhook route', () => {
  it('replaces a canceled subscription using an expected checkout even while the DB status is active', async () => {
    const pending = {
      ...org,
      billingCheckoutToken: 'new_attempt',
      billingCheckoutPlanId: 'audit-essencial',
      billingCheckoutSessionId: 'cs_new',
    };
    mocks.acquireOrgLease.mockResolvedValue(pending);
    mocks.retrieveSubscription
      .mockResolvedValueOnce({ id: 'sub_org', customer: 'cus_org', status: 'canceled' })
      .mockResolvedValueOnce({
        id: 'sub_new',
        customer: 'cus_org',
        status: 'active',
        metadata: { organization_id: 'org', checkout_token: 'new_attempt' },
        items: { data: [{ price: { id: 'price_fixture' } }] },
      });
    expect(
      (
        await webhook(
          await eventRequest('checkout.session.completed', {
            id: 'cs_new',
            subscription: 'sub_new',
            client_reference_id: 'org',
            metadata: { checkout_token: 'new_attempt' },
          }),
        )
      ).status,
    ).toBe(200);
    expect(mocks.completeEvent).toHaveBeenCalledWith(
      {},
      'evt_fixture',
      expect.any(String),
      expect.objectContaining({
        stripeSubscriptionId: 'sub_new',
        status: 'active',
        checkoutToken: 'new_attempt',
        expectedCheckoutToken: 'new_attempt',
      }),
      expect.any(Date),
    );
  });
  it('rejects replacement checkout when the current Stripe subscription is still active', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.acquireOrgLease.mockResolvedValue({
      ...org,
      billingCheckoutToken: 'new_attempt',
      billingCheckoutSessionId: 'cs_new',
    });
    mocks.retrieveSubscription.mockResolvedValue({
      id: 'sub_org',
      customer: 'cus_org',
      status: 'active',
    });
    expect(
      (
        await webhook(
          await eventRequest('checkout.session.completed', {
            id: 'cs_new',
            subscription: 'sub_new',
            metadata: { checkout_token: 'new_attempt' },
          }),
        )
      ).status,
    ).toBe(500);
    expect(mocks.completeEvent).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it('verifies the actual subscription belongs to the persisted checkout before granting access', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.acquireOrgLease.mockResolvedValue({
      ...org,
      stripeSubscriptionId: null,
      billingCheckoutToken: 'new_attempt',
      billingCheckoutPlanId: 'audit-essencial',
      billingCheckoutSessionId: 'cs_new',
    });
    mocks.retrieveSubscription.mockResolvedValue({
      id: 'sub_new',
      customer: 'cus_org',
      status: 'active',
      metadata: { organization_id: 'org', checkout_token: 'other_attempt' },
      items: { data: [{ price: { id: 'price_fixture' } }] },
    });
    expect(
      (
        await webhook(
          await eventRequest('checkout.session.completed', {
            id: 'cs_new',
            subscription: 'sub_new',
            metadata: { checkout_token: 'new_attempt' },
          }),
        )
      ).status,
    ).toBe(500);
    expect(mocks.completeEvent).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it('rejects invalid signatures before touching the inbox', async () => {
    expect(
      (
        await webhook(
          new Request('https://imovi.test/api/billing/webhook', { method: 'POST', body: '{}' }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.claimEvent).not.toHaveBeenCalled();
  });
  it('reconciles Stripe current subscription; a paid invoice does not reactivate cancellation', async () => {
    expect((await webhook(await eventRequest('invoice.paid'))).status).toBe(200);
    expect(mocks.retrieveSubscription).toHaveBeenCalledWith('sk_test_fixture', 'sub_org');
    expect(mocks.completeEvent).toHaveBeenCalledWith(
      {},
      'evt_fixture',
      expect.any(String),
      expect.objectContaining({ status: 'suspended', organizationId: 'org' }),
      expect.any(Date),
    );
  });
  it('reconciles the current subscription when an old subscription delivery arrives', async () => {
    expect(
      (await webhook(await eventRequest('customer.subscription.deleted', { id: 'sub_old' })))
        .status,
    ).toBe(200);
    expect(mocks.retrieveSubscription).toHaveBeenCalledWith('sk_test_fixture', 'sub_org');
  });
  it('uses the configured subscription price when Portal has changed the metadata plan', async () => {
    mocks.retrieveSubscription.mockResolvedValue({
      id: 'sub_org',
      customer: 'cus_org',
      status: 'active',
      metadata: { organization_id: 'org', plan_id: 'audit-escala' },
      items: { data: [{ price: { id: 'price_fixture' } }] },
    });
    expect((await webhook(await eventRequest('invoice.paid'))).status).toBe(200);
    expect(mocks.completeEvent).toHaveBeenCalledWith(
      {},
      'evt_fixture',
      expect.any(String),
      expect.objectContaining({ plan: 'audit-essencial', maxCorretores: 5 }),
      expect.any(Date),
    );
  });
  it('does not consume subscriptions with unknown prices or forged organization metadata', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.retrieveSubscription.mockResolvedValue({
      id: 'sub_org',
      customer: 'cus_org',
      status: 'active',
      metadata: { organization_id: 'other-org' },
      items: { data: [{ price: { id: 'price_fixture' } }] },
    });
    expect((await webhook(await eventRequest('invoice.paid'))).status).toBe(500);
    expect(mocks.completeEvent).not.toHaveBeenCalled();
    mocks.retrieveSubscription.mockResolvedValue({
      id: 'sub_org',
      customer: 'cus_org',
      status: 'active',
      metadata: { organization_id: 'org' },
      items: { data: [{ price: { id: 'price_unrecognized' } }] },
    });
    expect((await webhook(await eventRequest('invoice.paid'))).status).toBe(500);
    expect(mocks.completeEvent).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it('returns success only for processed duplicates; busy leases request a retry', async () => {
    mocks.claimEvent.mockResolvedValue('processed');
    expect((await webhook(await eventRequest('invoice.paid'))).status).toBe(200);
    expect(mocks.retrieveSubscription).not.toHaveBeenCalled();
    mocks.claimEvent.mockResolvedValue('busy');
    expect((await webhook(await eventRequest('invoice.paid'))).status).toBe(503);
  });
  it('keeps failures retryable and prevents mismatched customers from receiving entitlement', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.retrieveSubscription.mockResolvedValue({
      id: 'sub_org',
      customer: 'cus_other',
      status: 'active',
      metadata: { organization_id: 'org', plan_id: 'audit-essencial' },
      items: { data: [{ price: { id: 'price_fixture' } }] },
    });
    expect((await webhook(await eventRequest('invoice.paid'))).status).toBe(500);
    expect(mocks.completeEvent).not.toHaveBeenCalled();
    expect(mocks.releaseEvent).toHaveBeenCalledWith({}, 'evt_fixture', expect.any(String), 'org');
    log.mockRestore();
  });
});
describe('durable checkout attempts', () => {
  const request = (planId = 'audit-essencial') =>
    new Request('https://imovi.test/api/billing/checkout', {
      method: 'POST',
      headers: { origin: 'https://imovi.test' },
      body: JSON.stringify({ planId }),
    });
  const freshOrg = () => ({
    ...org,
    stripeSubscriptionId: null,
    billingCheckoutToken: null,
    billingCheckoutPlanId: null,
    billingCheckoutSessionId: null,
    billingCheckoutExpiresAt: null,
    billingCheckoutRequest: null,
  });
  const session = { id: 'cs_new', status: 'open', url: 'https://checkout.stripe.test/new' };
  it.each(['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'])(
    'blocks another subscription while Stripe status is %s',
    async (status) => {
      mocks.retrieveSubscription.mockResolvedValue({ id: 'sub_org', customer: 'cus_org', status });
      expect((await checkout(request())).status).toBe(409);
      expect(mocks.beginCheckout).not.toHaveBeenCalled();
      expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
      expect(mocks.releaseOrgLease).toHaveBeenCalled();
    },
  );
  it('creates one durable attempt before calling Stripe, even for overlapping clicks', async () => {
    const state = freshOrg();
    let leased = false;
    let finish!: (value: typeof session) => void;
    mocks.acquireOrgLease.mockImplementation(async () => {
      if (leased) return null;
      leased = true;
      return { ...state };
    });
    mocks.createCheckoutSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = checkout(request());
    await vi.waitFor(() => expect(mocks.createCheckoutSession).toHaveBeenCalledOnce());
    expect((await checkout(request())).status).toBe(409);
    expect(mocks.beginCheckout).toHaveBeenCalledOnce();
    expect(mocks.beginCheckout.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createCheckoutSession.mock.invocationCallOrder[0]!,
    );
    finish(session);
    expect((await first).status).toBe(200);
    expect(mocks.createCheckoutSession).toHaveBeenCalledOnce();
    expect(mocks.saveCheckoutSession).toHaveBeenCalledWith(
      {},
      'org',
      expect.any(String),
      expect.any(String),
      'cs_new',
    );
  });
  it.each(['Stripe timeout', 'session persistence crash'])(
    'resumes the exact persisted request after %s',
    async (failure) => {
      const state = freshOrg() as ReturnType<typeof freshOrg> & {
        billingCheckoutToken: string | null;
        billingCheckoutPlanId: string | null;
        billingCheckoutExpiresAt: Date | null;
        billingCheckoutRequest: Record<string, string> | null;
      };
      mocks.acquireOrgLease.mockImplementation(async () => ({ ...state }));
      mocks.beginCheckout.mockImplementation(
        async (_db, _org, _lease, token, plan, expiry, params) => {
          Object.assign(state, {
            billingCheckoutToken: token,
            billingCheckoutPlanId: plan,
            billingCheckoutExpiresAt: expiry,
            billingCheckoutRequest: params,
          });
        },
      );
      mocks.createCheckoutSession.mockResolvedValue(session);
      if (failure === 'Stripe timeout')
        mocks.createCheckoutSession.mockRejectedValueOnce(new Error('timeout after creation'));
      else mocks.saveCheckoutSession.mockRejectedValueOnce(new Error('process interrupted'));
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      expect((await checkout(request())).status).toBe(502);
      const original = mocks.createCheckoutSession.mock.calls[0]![0];
      mocks.requireOrgAdminIdentity.mockResolvedValue({
        org: state,
        email: 'different-admin@imovi.test',
      });
      expect((await checkout(request())).status).toBe(200);
      expect(mocks.beginCheckout).toHaveBeenCalledOnce();
      expect(mocks.createCheckoutSession.mock.calls[1]![0]).toEqual(original);
      expect(state.billingCheckoutToken).toBe(original.checkoutToken);
      log.mockRestore();
    },
  );
  it('reuses the saved open session and rejects switching plans before expiration', async () => {
    mocks.acquireOrgLease.mockResolvedValue({
      ...freshOrg(),
      billingCheckoutToken: 'attempt',
      billingCheckoutPlanId: 'audit-essencial',
      billingCheckoutSessionId: 'cs_saved',
    });
    mocks.retrieveCheckoutSession.mockResolvedValue({
      ...session,
      id: 'cs_saved',
      customer: 'cus_org',
      metadata: { organization_id: 'org', checkout_token: 'attempt' },
    });
    expect((await checkout(request())).status).toBe(200);
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
    expect((await checkout(request('audit-profissional'))).status).toBe(409);
    expect(mocks.beginCheckout).not.toHaveBeenCalled();
  });
  it('creates a new attempt only after the saved session is confirmed expired', async () => {
    mocks.acquireOrgLease.mockResolvedValue({
      ...freshOrg(),
      billingCheckoutToken: 'expired_attempt',
      billingCheckoutPlanId: 'audit-essencial',
      billingCheckoutSessionId: 'cs_expired',
    });
    mocks.retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_expired',
      status: 'expired',
      url: null,
      customer: 'cus_org',
      metadata: { organization_id: 'org', checkout_token: 'expired_attempt' },
    });
    mocks.createCheckoutSession.mockResolvedValue(session);
    expect((await checkout(request())).status).toBe(200);
    expect(mocks.beginCheckout.mock.calls[0]![3]).not.toBe('expired_attempt');
  });
  it('keeps a timed-out attempt without a session ID intact instead of starting another', async () => {
    const pending = {
      ...freshOrg(),
      billingCheckoutToken: 'unknown_attempt',
      billingCheckoutPlanId: 'audit-essencial',
      billingCheckoutExpiresAt: new Date(Date.now() - 90_000),
      billingCheckoutRequest: { expires_at: '1', 'metadata[checkout_token]': 'unknown_attempt' },
    };
    mocks.acquireOrgLease.mockResolvedValue(pending);
    mocks.createCheckoutSession.mockRejectedValue(new Error('Stripe unavailable'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await checkout(request())).status).toBe(502);
    expect(mocks.beginCheckout).not.toHaveBeenCalled();
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith({
      secretKey: 'sk_test_fixture',
      organizationId: 'org',
      checkoutToken: 'unknown_attempt',
      request: pending.billingCheckoutRequest,
    });
    log.mockRestore();
  });
});
describe('Stripe checkout request persistence', () => {
  it('sends identical parameters and idempotency key when replaying a saved attempt', async () => {
    const stripe = await vi.importActual<typeof stripeModule>('../src/lib/stripe-edge');
    const billing = await import('../src/lib/billing');
    const params = stripe.buildCheckoutRequest({
      priceId: 'price_fixture',
      plan: billing.getBillingPlan('audit-essencial')!,
      organizationId: 'org',
      customerId: 'cus_org',
      customerEmail: 'owner@imovi.test',
      appUrl: 'https://imovi.test',
      checkoutToken: 'attempt',
      expiresAt: new Date('2026-10-01T10:00:00Z'),
    });
    const fetchMock = vi.fn(async () =>
      Response.json({ id: 'cs_saved', status: 'open', url: 'https://checkout.stripe.test/saved' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      // jsonb may reorder keys, so replay must preserve the outbound form as well as its values.
      const persisted = Object.fromEntries(Object.entries(params).reverse());
      await stripe.createCheckoutSession({
        secretKey: 'fixture',
        organizationId: 'org',
        checkoutToken: 'attempt',
        request: params,
      });
      await stripe.createCheckoutSession({
        secretKey: 'fixture',
        organizationId: 'org',
        checkoutToken: 'attempt',
        request: persisted,
      });
      const first = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      const retry = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
      expect(first[1].body?.toString()).toBe(retry[1].body?.toString());
      expect(first[1].headers).toEqual(
        expect.objectContaining({ 'Idempotency-Key': 'checkout:org:attempt' }),
      );
      expect(retry[1].headers).toEqual(first[1].headers);
      expect(persisted['subscription_data[metadata][checkout_token]']).toBe('attempt');
      expect(persisted.customer).toBe('cus_org');
      expect(persisted.customer_email).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
describe('billing administrative routes', () => {
  it.each(['null', '[]', 'true'])(
    'rejects non-object checkout bodies (%s) before resolving identity',
    async (body) => {
      expect(
        (
          await checkout(
            new Request('https://imovi.test/api/billing/checkout', {
              method: 'POST',
              headers: { origin: 'https://imovi.test' },
              body,
            }),
          )
        ).status,
      ).toBe(400);
      expect(mocks.requireOrgAdminIdentity).not.toHaveBeenCalled();
      expect(mocks.acquireOrgLease).not.toHaveBeenCalled();
    },
  );
  it('member checkout and portal requests never reach Stripe', async () => {
    mocks.requireOrgAdminIdentity.mockRejectedValue(
      new SessionError(403, 'admin_required', 'Admin required'),
    );
    const request = () =>
      new Request('https://imovi.test/api/billing', {
        method: 'POST',
        headers: { origin: 'https://imovi.test' },
        body: JSON.stringify({ planId: 'audit-essencial' }),
      });
    expect((await checkout(request())).status).toBe(403);
    expect((await portal(request())).status).toBe(403);
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
    expect(mocks.createPortalSession).not.toHaveBeenCalled();
  });
});

describe('administrative audit configuration', () => {
  it('rejects member access to both configuration reads and writes', async () => {
    mocks.requireOrgAdmin.mockRejectedValue(
      new SessionError(403, 'admin_required', 'Admin required'),
    );
    expect((await configGet(new Request('https://imovi.test/api/auditoria/config'))).status).toBe(
      403,
    );
    expect(
      (
        await configPut(
          new Request('https://imovi.test/api/auditoria/config', {
            method: 'PUT',
            headers: { origin: 'https://imovi.test' },
            body: '{}',
          }),
        )
      ).status,
    ).toBe(403);
  });
  it('denies cross-origin configuration writes before resolving identity', async () => {
    expect(
      (
        await configPut(
          new Request('https://imovi.test/api/auditoria/config', {
            method: 'PUT',
            body: '{}',
            headers: { origin: 'https://other.test' },
          }),
        )
      ).status,
    ).toBe(403);
    expect(mocks.requireOrgAdmin).not.toHaveBeenCalled();
  });
});
