import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  member: vi.fn(),
  org: vi.fn(),
  usage: vi.fn(),
  list: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  getAuth: () => ({ api: { getSession: mocks.session } }),
  AuthConfigurationError: class extends Error {},
}));
vi.mock('@/lib/cf-env', async (original) => ({
  ...(await original<object>()),
  getCfEnv: async () => ({}),
}));
vi.mock('@/lib/db', () => ({ getDb: () => ({}) }));
vi.mock('@imovi/db/members', () => ({ memberRepo: { findByUserAndOrg: mocks.member } }));
vi.mock('@imovi/db/orgs', () => ({ orgRepo: { findById: mocks.org } }));
vi.mock('@imovi/db/rate-limit', () => ({ usageCounterRepo: { getMonthlyUsage: mocks.usage } }));
vi.mock('@imovi/db/estimates', () => ({ estimateRepo: { listByOwnerUserId: mocks.list } }));
import { GET as entitlements } from '../src/app/api/me/entitlements/route';
import { GET as history } from '../src/app/api/conta/estimativas/route';
import { GET as metrics } from '../src/app/api/auditoria/metrics/route';
import { middleware } from '../src/middleware';

function request(path = '/api/me/entitlements', authenticated = true) {
  return new NextRequest(`https://imovi.test${path}`, {
    headers: authenticated ? { cookie: 'session=fixture' } : {},
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: URL, init: RequestInit) => entitlements(new Request(url, init))),
  );
  mocks.session.mockResolvedValue({
    user: { id: 'alice', email: 'alice@example.test', emailVerified: true },
    session: { activeOrganizationId: 'pro' },
  });
  mocks.member.mockResolvedValue({ role: 'owner' });
  mocks.org.mockResolvedValue({
    id: 'pro',
    plan: 'corretor_pro',
    status: 'active',
    trialEndsAt: null,
  });
  mocks.usage.mockResolvedValue({ count: 27, renewsAt: new Date('2027-01-01Z') });
  mocks.list.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllGlobals());

describe('entitlements and history', () => {
  it('reports anonymous defaults without authenticating visitors', async () => {
    expect(await (await entitlements(request(undefined, false))).json()).toEqual({
      authenticated: false,
      product: null,
      plan: null,
      ads: true,
      history: false,
      quota: null,
    });
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it.each(['active', 'past_due', 'trial'])(
    'grants Pro rights for %s with current usage',
    async (status) => {
      mocks.org.mockResolvedValue({
        id: 'pro',
        plan: 'corretor_pro',
        status,
        trialEndsAt: new Date('2099-01-01Z'),
      });
      const response = await entitlements(request());
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({
        authenticated: true,
        product: 'corretor_pro',
        plan: 'corretor_pro',
        ads: false,
        history: true,
        quota: { limit: 100, used: 27, remaining: 73, renewsAt: '2027-01-01T00:00:00.000Z' },
      });
    },
  );
  it.each(['suspended', 'canceled', 'pending', 'trial'])(
    'does not grant rights for %s with no valid trial',
    async (status) => {
      mocks.org.mockResolvedValue({ id: 'pro', plan: 'corretor_pro', status, trialEndsAt: null });
      expect(await (await entitlements(request())).json()).toMatchObject({
        authenticated: true,
        ads: true,
        history: false,
        quota: null,
      });
      expect(mocks.usage).not.toHaveBeenCalled();
    },
  );
  it('does not trust revoked membership or an expired trial', async () => {
    mocks.member.mockResolvedValue(null);
    expect(await (await entitlements(request())).json()).toMatchObject({ ads: true, quota: null });
    mocks.member.mockResolvedValue({ role: 'owner' });
    mocks.org.mockResolvedValue({
      id: 'pro',
      plan: 'corretor_pro',
      status: 'trial',
      trialEndsAt: new Date('2000-01-01Z'),
    });
    expect(await (await entitlements(request())).json()).toMatchObject({ ads: true, quota: null });
  });
  it('fails closed on infrastructure errors instead of reporting anonymous rights', async () => {
    mocks.usage.mockRejectedValue(new Error('offline'));
    expect((await entitlements(request())).status).toBe(503);
  });
  it('uses session ownership, ignoring a forged user query, and denies anonymous history', async () => {
    expect((await history(request('/api/conta/estimativas?userId=bob'))).status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith({}, 'alice', { limit: 50, offset: 0 });
    mocks.session.mockResolvedValue(null);
    expect((await history(request())).status).toBe(401);
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });
});

describe('product isolation (AC-P1)', () => {
  it('rejects an actual audit API route with 403 before querying audit data', async () => {
    expect((await metrics(request('/api/auditoria/metrics'))).status).toBe(403);
  });
  it.each([
    '/auditoria',
    '/auditoria/configuracao',
    '/auditoria/assinatura',
    '/auditoria/login',
    '/api/auditoria/termos',
    '/api/auditoria/leads',
  ])('blocks Pro at %s regardless of subscription status', async (path) => {
    for (const status of ['active', 'suspended', 'canceled']) {
      mocks.org.mockResolvedValue({ id: 'pro', plan: 'corretor_pro', status, trialEndsAt: null });
      expect((await middleware(request(path))).status).toBe(403);
    }
  });
  it('allows public registration and login for anonymous visitors', async () => {
    expect((await middleware(request('/auditoria/login', false))).status).toBe(200);
    expect((await middleware(request('/auditoria/cadastro', false))).status).toBe(200);
  });
});
