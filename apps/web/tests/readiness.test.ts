import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ env: vi.fn(), execute: vi.fn() }));
vi.mock('../src/lib/cf-env', () => ({ getCfEnv: mocks.env }));
vi.mock('../src/lib/db', () => ({ getDb: () => ({ execute: mocks.execute }) }));
import { GET } from '../src/app/api/ready/route';

describe('readiness', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    mocks.env.mockResolvedValue({ DATABASE_URL: 'test' });
    mocks.execute.mockResolvedValue([]);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });
  it('returns 200 when configured and the database is reachable', async () => {
    expect((await GET()).status).toBe(200);
  });
  it('returns 503 for database failure without exposing provider errors', async () => {
    mocks.execute.mockRejectedValue(new Error('credential-must-not-leak'));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('credential-must-not-leak');
  });
  it('fails closed for incomplete production configuration', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await GET()).status).toBe(503);
    mocks.env.mockResolvedValue({
      DATABASE_URL: 'test',
      TURNSTILE_SECRET: 'turnstile',
      BETTER_AUTH_SECRET: 's'.repeat(32),
      BETTER_AUTH_URL: 'https://example.com',
      RESEND_API_KEY: 'resend',
      EMAIL_FROM: 'test@example.com',
    });
    expect((await GET()).status).toBe(200);
  });
  it('requires production configuration for Cloudflare preview bindings', async () => {
    mocks.env.mockResolvedValue({ DATABASE_URL: 'test', NEXT_PUBLIC_APP_ENV: 'preview' });
    expect((await GET()).status).toBe(503);
  });
});
