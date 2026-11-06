import { beforeEach, describe, expect, it, vi } from 'vitest';

const consume = vi.hoisted(() => vi.fn());
vi.mock('@imovi/db/rate-limit', () => ({ rateLimitRepo: { consume } }));
import {
  clientIp,
  consumeEstimateLimit,
  estimateLimit,
  verifyTurnstile,
  requiresProductionProtection,
} from '../src/lib/estimate-protection';

describe('estimate protection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    consume.mockReset();
  });
  it('uses bounded defaults and rejects unavailable production IP', () => {
    expect(estimateLimit()).toBe(10);
    expect(estimateLimit('0')).toBe(10);
    expect(estimateLimit('1001')).toBe(10);
    expect(estimateLimit('20')).toBe(20);
    expect(requiresProductionProtection({ NEXT_PUBLIC_APP_ENV: 'preview' })).toBe(true);
    expect(clientIp(new Request('https://example.test'), true)).toBeNull();
    expect(
      clientIp(
        new Request('https://example.test', { headers: { 'x-forwarded-for': '1.2.3.4' } }),
        true,
      ),
    ).toBeNull();
    expect(clientIp(new Request('http://localhost'), false)).toBe('local-development');
  });
  it('uses SHA256 keys, minute windows and boundary retry durations', async () => {
    consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 1 });
    const db = {} as Parameters<typeof consumeEstimateLimit>[0];
    const result = await consumeEstimateLimit(db, '1.2.3.4', 10, 119999);
    expect(result).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(consume.mock.calls[0]?.[1]).toMatch(/^[a-f0-9]{64}$/);
    expect(consume.mock.calls[0]?.[1]).not.toContain('1.2.3.4');
    expect(consume.mock.calls[0]?.[2]).toEqual(new Date(60000));
    expect(consume.mock.calls[0]?.[4]).toEqual(new Date(119999));
    await consumeEstimateLimit(db, '1.2.3.4', 10, 120000);
    expect(consume.mock.calls[1]?.[2]).toEqual(new Date(120000));
  });
  it('uses explicit binding secret and rejects invalid verification', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ success: true }));
    expect(await verifyTurnstile('', 'token', '1.2.3.4')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await verifyTurnstile('binding-secret', 'token', '1.2.3.4')).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      secret: 'binding-secret',
      response: 'token',
    });
    fetchMock.mockResolvedValue(Response.json({ success: false }));
    expect(await verifyTurnstile('binding-secret', 'token', '1.2.3.4')).toBe(false);
  });
});
