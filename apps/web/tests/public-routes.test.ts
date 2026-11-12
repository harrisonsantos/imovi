import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as EstimateProtection from '../src/lib/estimate-protection';

const mocks = vi.hoisted(() => ({
  env: vi.fn(),
  db: vi.fn(),
  consume: vi.fn(),
  verify: vi.fn(),
  city: vi.fn(),
  record: vi.fn(),
  find: vi.fn(),
  register: vi.fn(),
  select: vi.fn(),
  access: vi.fn(),
  quota: vi.fn(),
}));
vi.mock('@/lib/entitlements', () => ({ resolveEstimateAccess: mocks.access }));
vi.mock('@imovi/db/rate-limit', () => ({ usageCounterRepo: { consumeMonthlyQuota: mocks.quota } }));
vi.mock('@/lib/cf-env', () => ({ getCfEnv: mocks.env }));
vi.mock('@/lib/db', () => ({ getDb: mocks.db }));
vi.mock('@imovi/db/estimates', () => ({
  estimateRepo: { record: mocks.record, findById: mocks.find },
}));
vi.mock('@imovi/db/cities', () => ({ cityRepo: { findByNameState: mocks.city } }));
vi.mock('@imovi/db/waitlist', () => ({ waitlistRepo: { register: mocks.register } }));
vi.mock('@/lib/estimate-protection', async () => {
  const actual = await vi.importActual<typeof EstimateProtection>('../src/lib/estimate-protection');
  return { ...actual, consumeEstimateLimit: mocks.consume, verifyTurnstile: mocks.verify };
});
import { POST as estimate } from '../src/app/api/estimate/route';
import { GET as getEstimate } from '../src/app/api/estimates/[id]/route';
import { POST as waitlist } from '../src/app/api/waitlist/route';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const payload = {
  city: 'Curitiba',
  state: 'PR',
  neighborhood: 'Batel',
  area: 62,
  propertyType: 'apartment',
  turnstileToken: 'token',
};
function request(
  body: unknown = payload,
  headers: Record<string, string> = { 'cf-connecting-ip': '1.2.3.4' },
) {
  return new Request('https://example.test/api/estimate', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}
function saved() {
  return {
    id,
    estimate: '620000.00',
    confidenceLow: '434000.00',
    confidenceHigh: '806000.00',
    modelVersion: 'heuristic-v0',
    featuresUsed: { areaM2: 62, neighborhoodPriceM2: 10000 },
    inputPayload: payload,
    resultMetadata: {
      method: 'heuristic',
      neighborhood: { name: 'Batel', medianPriceM2: 10000 },
      dataSource: { kind: 'seed_reference', sampleCount: 0, updatedAt: null },
      generatedAt: '2026-09-30T12:00:00.000Z',
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({ session: null, org: null, plan: null });
  mocks.quota.mockResolvedValue({
    allowed: true,
    count: 1,
    remaining: 99,
    limit: 100,
    renewsAt: new Date('2027-01-01Z'),
  });
  mocks.env.mockResolvedValue({
    NODE_ENV: 'production',
    TURNSTILE_SECRET: 'binding-secret',
    DATABASE_URL: 'unused',
  });
  mocks.consume.mockResolvedValue({ allowed: true, retryAfterSeconds: 60 });
  mocks.verify.mockResolvedValue(true);
  mocks.city.mockResolvedValue({ active: true });
  const limit = vi.fn().mockResolvedValue([
    {
      name: 'Batel',
      medianPriceM2: '10000',
      listingCount: 0,
      lastAggregatedAt: null,
      priceSource: 'seed_reference',
    },
  ]);
  mocks.select.mockReturnValue({ from: () => ({ where: () => ({ limit }) }) });
  mocks.db.mockReturnValue({ select: mocks.select });
  mocks.record.mockImplementation(async (_db: unknown, row: Record<string, unknown>) => ({
    id,
    ...row,
  }));
  mocks.find.mockResolvedValue(saved());
  mocks.register.mockResolvedValue(id);
});

describe('POST estimate', () => {
  it('uses authenticated Pro instead of Turnstile, retaining minute protection and ownership', async () => {
    mocks.access.mockResolvedValue({
      session: { userId: 'alice' },
      org: { id: 'pro' },
      plan: { entitlements: { monthlyEstimatesQuota: 100 } },
    });
    mocks.env.mockResolvedValue({ NODE_ENV: 'production', DATABASE_URL: 'unused' });
    const response = await estimate(request({ ...payload, turnstileToken: undefined }));
    expect(response.status).toBe(200);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.consume).toHaveBeenCalled();
    expect(mocks.quota).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orgId: 'pro', metric: 'estimates', limit: 100 }),
    );
    expect(mocks.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ownerUserId: 'alice' }),
    );
  });
  it('returns 402 on exhausted quota and never falls back to anonymous', async () => {
    mocks.access.mockResolvedValue({
      session: { userId: 'alice' },
      org: { id: 'pro' },
      plan: { entitlements: { monthlyEstimatesQuota: 100 } },
    });
    mocks.quota.mockResolvedValue({
      allowed: false,
      limit: 100,
      renewsAt: new Date('2027-01-01Z'),
    });
    const response = await estimate(request());
    expect(response.status).toBe(402);
    expect(await response.json()).toMatchObject({
      error: 'quota_exceeded',
      limit: 100,
      renewsAt: '2027-01-01T00:00:00.000Z',
    });
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it('does not consume quota for invalid input or a minute limit rejection', async () => {
    mocks.access.mockResolvedValue({
      session: { userId: 'alice' },
      org: { id: 'pro' },
      plan: { entitlements: { monthlyEstimatesQuota: 100 } },
    });
    expect((await estimate(request({ ...payload, area: 0 }))).status).toBe(400);
    mocks.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 5 });
    expect((await estimate(request())).status).toBe(429);
    expect(mocks.quota).not.toHaveBeenCalled();
  });
  it('fails closed if production anti-bot or trusted IP configuration is missing', async () => {
    mocks.env.mockResolvedValue({ NODE_ENV: 'production' });
    expect((await estimate(request())).status).toBe(503);
    expect(mocks.db).not.toHaveBeenCalled();
    mocks.env.mockResolvedValue({ NODE_ENV: 'production', TURNSTILE_SECRET: 'binding-secret' });
    expect((await estimate(request(payload, {}))).status).toBe(503);
  });
  it('applies rate limit before token verification, with Retry-After', async () => {
    mocks.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 7 });
    const response = await estimate(request());
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('7');
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it('rejects missing and invalid tokens before calculation', async () => {
    mocks.verify.mockResolvedValue(false);
    expect((await estimate(request({ ...payload, turnstileToken: undefined }))).status).toBe(401);
    expect((await estimate(request())).status).toBe(401);
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it('persists sanitized input and returns the same monetary snapshot on retrieval', async () => {
    const response = await estimate(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      id,
      reference: id,
      estimate: 620000,
      method: 'heuristic',
      featuresUsed: { areaM2: 62 },
      dataSource: { kind: 'seed_reference' },
    });
    expect(mocks.verify).toHaveBeenCalledWith('binding-secret', 'token', '1.2.3.4');
    const recorded = mocks.record.mock.calls[0]?.[1];
    expect(recorded.inputPayload).not.toHaveProperty('turnstileToken');
    mocks.find.mockResolvedValue({ id, ...recorded });
    const recovered = await getEstimate(new Request('https://example.test'), {
      params: Promise.resolve({ id }),
    });
    expect(await recovered.json()).toEqual(body);
    expect(recovered.headers.get('Cache-Control')).toBe('no-store');
  });
  it('does not report success when persistence fails', async () => {
    mocks.record.mockRejectedValue(new Error('db down'));
    expect((await estimate(request())).status).toBe(503);
  });
  it('does not label fewer than 20 properties as an observed median', async () => {
    mocks.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              name: 'Batel',
              medianPriceM2: '10000',
              listingCount: 19,
              lastAggregatedAt: new Date('2026-09-30T12:00:00Z'),
              priceSource: 'observed_listings',
            },
          ],
        }),
      }),
    });
    const response = await estimate(request());
    const body = (await response.json()) as { dataSource: unknown };
    expect(body.dataSource).toMatchObject({ kind: 'insufficient_data', sampleCount: 19 });
  });
  it('identifies a verified aggregate of twenty distinct properties', async () => {
    mocks.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              name: 'Batel',
              medianPriceM2: '10000',
              listingCount: 20,
              lastAggregatedAt: new Date('2026-09-30T12:00:00Z'),
              priceSource: 'observed_listings',
            },
          ],
        }),
      }),
    });
    const response = await estimate(request());
    const body = (await response.json()) as { dataSource: unknown };
    expect(body.dataSource).toMatchObject({
      kind: 'listing_aggregate',
      sampleCount: 20,
      updatedAt: '2026-09-30T12:00:00.000Z',
    });
  });
  it('rejects unavailable coverage and invalid input without storing an estimate', async () => {
    expect((await estimate(request({ ...payload, area: 0 }))).status).toBe(400);
    mocks.city.mockResolvedValue({ active: false });
    expect((await estimate(request())).status).toBe(422);
    expect(mocks.record).not.toHaveBeenCalled();
  });
});

describe('GET saved estimate', () => {
  it('rejects malformed references and missing results without inventing a report', async () => {
    expect(
      (
        await getEstimate(new Request('https://example.test'), {
          params: Promise.resolve({ id: 'bad' }),
        })
      ).status,
    ).toBe(400);
    expect(mocks.find).not.toHaveBeenCalled();
    mocks.find.mockResolvedValue(null);
    expect(
      (await getEstimate(new Request('https://example.test'), { params: Promise.resolve({ id }) }))
        .status,
    ).toBe(404);
  });
});

describe('POST waitlist', () => {
  it('requires consent and a valid email', async () => {
    expect((await waitlist(request({ email: 'hello@example.test', consent: false }))).status).toBe(
      400,
    );
    expect((await waitlist(request({ email: 'bad', consent: true }))).status).toBe(400);
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it('normalizes email and reports success only after registration', async () => {
    const response = await waitlist(request({ email: ' Hello@Example.test ', consent: true }));
    expect(response.status).toBe(200);
    expect(mocks.register).toHaveBeenCalledWith(expect.anything(), {
      email: 'hello@example.test',
      source: 'precos',
      consentVersion: 'waitlist-updates-v1',
    });
    mocks.register.mockRejectedValue(new Error('db unavailable'));
    expect((await waitlist(request({ email: 'hello@example.test', consent: true }))).status).toBe(
      503,
    );
  });
  it('limits abusive registrations before storage', async () => {
    mocks.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 20 });
    const response = await waitlist(request({ email: 'hello@example.test', consent: true }));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('20');
    expect(mocks.register).not.toHaveBeenCalled();
  });
});
