import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthConfigurationError, getAuth, sendVerificationEmail } from '../src/lib/auth';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('production identity configuration', () => {
  it('fails closed before constructing auth when the production secret is absent', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BETTER_AUTH_SECRET', '');
    expect(() =>
      getAuth({
        DATABASE_URL: 'postgresql://fixture:fixture@localhost/fixture',
        BETTER_AUTH_URL: 'https://imovi.test',
        RESEND_API_KEY: 'fixture',
        EMAIL_FROM: 'fixture@imovi.test',
      }),
    ).toThrow(AuthConfigurationError);
  });
  it('requires a configured HTTPS auth URL and transactional email sender in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('EMAIL_FROM', '');
    expect(() =>
      getAuth({ BETTER_AUTH_SECRET: 'x'.repeat(32), BETTER_AUTH_URL: 'http://localhost:3000' }),
    ).toThrow(AuthConfigurationError);
  });
  it('sends a verification link through Resend without putting tokens in logs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await sendVerificationEmail(
      { RESEND_API_KEY: 'test-fixture', EMAIL_FROM: 'Imovi <verify@imovi.test>' },
      'user@example.com',
      'https://imovi.test/api/auth/verify-email?token=fixture',
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.resend.com/emails');
    expect(JSON.parse(String(init.body))).toMatchObject({
      to: ['user@example.com'],
      text: expect.stringContaining('token=fixture'),
    });
  });
  it('does not confirm success when mail configuration or delivery is unavailable', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('EMAIL_FROM', '');
    await expect(
      sendVerificationEmail({}, 'user@example.com', 'https://imovi.test'),
    ).rejects.toThrow(AuthConfigurationError);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
    await expect(
      sendVerificationEmail(
        { RESEND_API_KEY: 'fixture', EMAIL_FROM: 'verify@imovi.test' },
        'user@example.com',
        'https://imovi.test',
      ),
    ).rejects.toThrow('enviar');
  });
});
