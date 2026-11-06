import { afterEach, describe, expect, it, vi } from 'vitest';

const context = vi.hoisted(() => vi.fn());
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: context }));
import { authEnvOf, getCfEnv } from '../src/lib/cf-env';

afterEach(() => {
  vi.unstubAllEnvs();
  context.mockReset();
});

describe('Cloudflare Worker bindings', () => {
  it('prefers request bindings, preserves R2 objects and forwards auth and billing secrets', async () => {
    vi.stubEnv('DATABASE_URL', 'local-db');
    const model = { get: vi.fn() };
    const matriculas = { put: vi.fn() };
    const bindings = {
      DATABASE_URL: 'worker-db',
      BETTER_AUTH_SECRET: 'test-auth',
      BETTER_AUTH_URL: 'https://test.example',
      TURNSTILE_SECRET: 'test-turnstile',
      STRIPE_SECRET_KEY: 'test-stripe',
      STRIPE_WEBHOOK_SECRET: 'test-webhook',
      MODEL_ARTIFACTS: model,
      MATRICULAS: matriculas,
      NEXT_PUBLIC_APP_ENV: 'preview',
    };
    context.mockReturnValue({ env: bindings });

    const env = await getCfEnv();
    // Compare only test bindings: a failure must not print the host environment.
    for (const [key, value] of Object.entries(bindings)) expect(env[key]).toBe(value);
    expect(env.MODEL_ARTIFACTS).toBe(model);
    expect(env.MATRICULAS).toBe(matriculas);
    expect(authEnvOf(env)).toMatchObject({
      DATABASE_URL: 'worker-db',
      BETTER_AUTH_SECRET: 'test-auth',
      BETTER_AUTH_URL: 'https://test.example',
    });
  });

  it('falls back to process.env when no Worker context exists', async () => {
    vi.stubEnv('DATABASE_URL', 'local-db');
    context.mockImplementation(() => {
      throw new Error('no context');
    });
    expect((await getCfEnv()).DATABASE_URL).toBe('local-db');
  });

  it('reads the current request instead of caching bindings across requests', async () => {
    context.mockReturnValueOnce({ env: { DATABASE_URL: 'preview-db' } });
    context.mockReturnValueOnce({ env: { DATABASE_URL: 'production-db' } });
    expect((await getCfEnv()).DATABASE_URL).toBe('preview-db');
    expect((await getCfEnv()).DATABASE_URL).toBe('production-db');
  });
});
