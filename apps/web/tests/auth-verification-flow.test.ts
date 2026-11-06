import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestDb, type TestDb } from '../../../packages/db/tests/setup.js';
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../src/lib/db.js', () => ({ getDb: () => state.db }));
import { getAuth, type AuthEnv } from '../src/lib/auth.js';
import { requireOrgAdmin } from '../src/lib/session.js';
import { buildSignupBody } from '../src/lib/cadastro.js';
import { TERMS_VERSION, PRIVACY_VERSION } from '../src/lib/terms-version.js';
import { termsRepo } from '@imovi/db/members';
const env: AuthEnv = {
  DATABASE_URL: 'postgresql://fixture:fixture@localhost/auth-integration',
  BETTER_AUTH_SECRET: 'fixture-production-secret-32-characters-only',
  BETTER_AUTH_URL: 'https://identity.imovi.test',
  RESEND_API_KEY: 'fixture-email-key',
  EMAIL_FROM: 'verify@imovi.test',
  NODE_ENV: 'production',
};
let testDb: TestDb;
let verificationUrl = '';
beforeAll(async () => {
  testDb = await createTestDb();
  state.db = testDb.db;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init?: RequestInit) => {
      if (url !== 'https://api.resend.com/emails') throw new Error('Unexpected network request');
      const message = JSON.parse(String(init?.body)) as { text: string };
      verificationUrl = message.text.match(/https:\/\/[^\s]+/)?.[0] ?? '';
      return Response.json({ id: 'email_fixture' });
    }),
  );
}, 20_000);
afterAll(async () => {
  vi.unstubAllGlobals();
  await testDb?.dispose();
});
function post(path: string, body: unknown, cookie?: string) {
  return getAuth(env).handler(
    new Request(`https://identity.imovi.test/api/auth/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://identity.imovi.test',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}
describe('verified identity onboarding with the real auth adapter', () => {
  it('creates a verified owner organization only after consuming the email confirmation', async () => {
    const credentials = {
      name: 'Owner',
      email: 'owner@example.test',
      password: 'fixture-password-123',
    };
    const withoutTerms = await post('sign-up/email', {
      ...credentials,
      callbackURL: '/auditoria/login',
    });
    expect(withoutTerms.status).toBe(400);
    expect(verificationUrl).toBe('');
    const signup = await post('sign-up/email', buildSignupBody(credentials));
    expect(signup.status).toBe(200);
    const accepted = await testDb.raw.query<{
      terms_version: string;
      privacy_version: string;
      source: string;
      accepted_at: Date;
    }>(
      `SELECT t.terms_version, t.privacy_version, t.source, t.accepted_at
       FROM terms_acceptances t JOIN users u ON u.id = t.user_id WHERE u.email = $1`,
      ['owner@example.test'],
    );
    expect(accepted.rows).toHaveLength(1);
    expect(accepted.rows[0]).toMatchObject({
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      source: 'signup',
    });
    expect(accepted.rows[0]?.accepted_at).toBeInstanceOf(Date);
    expect(signup.headers.get('set-cookie')).toBeNull();
    expect(verificationUrl).toContain('/verify-email?');
    const unverified = await post('sign-in/email', {
      email: 'owner@example.test',
      password: 'fixture-password-123',
    });
    expect(unverified.status).toBe(403);
    const verify = await getAuth(env).handler(new Request(verificationUrl));
    expect([200, 302]).toContain(verify.status);
    const login = await post('sign-in/email', {
      email: 'owner@example.test',
      password: 'fixture-password-123',
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    expect(cookie).toBeTruthy();
    // Sem aceite registrado, a imobiliária não é criada.
    const owner = await testDb.raw.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
      'owner@example.test',
    ]);
    const userId = owner.rows[0]!.id;
    await testDb.raw.query('DELETE FROM terms_acceptances WHERE user_id = $1', [userId]);
    const blocked = await post(
      'organization/create',
      { name: 'Blocked Organization', slug: 'blocked-organization' },
      cookie,
    );
    expect(blocked.status).toBeGreaterThanOrEqual(400);
    await termsRepo.record(testDb.db, {
      userId,
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
      source: 'auditoria_cadastro',
    });
    const create = await post(
      'organization/create',
      { name: 'Verified Organization', slug: 'verified-organization' },
      cookie,
    );
    expect(create.status).toBe(200);
    const org = (await create.json()) as { id: string };
    expect(org.id).toBeTruthy();
    const active = await post('organization/set-active', { organizationId: org.id }, cookie);
    expect(active.status).toBe(200);
    const info = await requireOrgAdmin(
      new Request('https://identity.imovi.test/api/auditoria/config', {
        headers: { Cookie: cookie! },
      }),
      env,
    );
    expect(info.role).toBe('owner');
    expect(info.org.id).toBe(org.id);
    expect(info.org.trialEndsAt).not.toBeNull();
    expect(
      (await post('organization/set-active', { organizationId: 'unrelated-organization' }, cookie))
        .status,
    ).toBeGreaterThanOrEqual(400);
  });
});
