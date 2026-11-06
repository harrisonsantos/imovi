import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from '@imovi/db/operators';
import { cities, neighborhoods, priceEstimates, waitlistContacts } from '@imovi/db/schema';
import { createTestDb, type TestDb } from '../../../packages/db/tests/setup.js';
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({ getDb: () => state.db }));
vi.mock('@/lib/cf-env', () => ({
  getCfEnv: async () => ({
    DATABASE_URL: 'fixture',
    NODE_ENV: 'production',
    TURNSTILE_SECRET: 'fixture-secret',
  }),
}));
import { POST as estimate } from '../src/app/api/estimate/route';
import { GET as retrieve } from '../src/app/api/estimates/[id]/route';
import { POST as waitlist } from '../src/app/api/waitlist/route';
let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
  state.db = t.db;
  await t.db
    .insert(cities)
    .values({ name: 'Curitiba', state: 'PR', slug: 'curitiba', active: true });
  await t.db
    .insert(neighborhoods)
    .values({
      city: 'Curitiba',
      state: 'PR',
      name: 'Batel',
      medianPriceM2: '10000',
      priceSource: 'seed_reference',
    });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url !== 'https://challenges.cloudflare.com/turnstile/v0/siteverify')
        throw new Error('Unexpected network');
      const submitted = JSON.parse(String(init.body)) as { response: string };
      return Response.json({ success: submitted.response === 'fixture-token' });
    }),
  );
  vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-09-30T15:00:00Z').getTime());
}, 20_000);
afterAll(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await t?.dispose();
});
function post(path: string, body: unknown, ip = '192.0.2.10') {
  return new Request(`https://imovi.test/api/${path}`, {
    method: 'POST',
    headers: { 'cf-connecting-ip': ip },
    body: JSON.stringify(body),
  });
}
const form = {
  city: 'Curitiba',
  state: 'PR',
  neighborhood: 'Batel',
  area: 62,
  propertyType: 'apartment',
  turnstileToken: 'fixture-token',
};
describe('public routes with the real SQL repositories', () => {
  it('retrieves the identical saved calculation after the source median changes', async () => {
    const response = await estimate(post('estimate', form));
    expect(response.status).toBe(200);
    const result = (await response.json()) as { id: string; estimate: number };
    expect(result).toMatchObject({
      estimate: 620000,
      method: 'heuristic',
      dataSource: { kind: 'seed_reference' },
      property: { area: 62 },
    });
    const [saved] = await t.db
      .select()
      .from(priceEstimates)
      .where(eq(priceEstimates.id, result.id));
    expect(saved?.inputPayload).not.toHaveProperty('turnstileToken');
    await t.db.update(neighborhoods).set({ medianPriceM2: '20000' });
    const recovered = await retrieve(new Request('https://imovi.test'), {
      params: Promise.resolve({ id: result.id }),
    });
    expect(await recovered.json()).toEqual(result);
  });
  it('counts invalid tokens durably, returns 429 at attempt eleven and isolates IPs', async () => {
    for (let i = 0; i < 10; i++) {
      expect(
        (await estimate(post('estimate', { ...form, turnstileToken: 'invalid' }, '192.0.2.20')))
          .status,
      ).toBe(401);
    }
    const limited = await estimate(post('estimate', form, '192.0.2.20'));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('60');
    expect((await estimate(post('estimate', form, '192.0.2.21'))).status).toBe(200);
  });
  it('stores consent before confirming and keeps a single normalized email', async () => {
    const body = { email: ' PERSON@example.test ', consent: true };
    expect((await waitlist(post('waitlist', body))).status).toBe(200);
    expect((await waitlist(post('waitlist', body))).status).toBe(200);
    const saved = await t.db.select().from(waitlistContacts);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      email: 'person@example.test',
      consentVersion: 'waitlist-updates-v1',
    });
  });
});
