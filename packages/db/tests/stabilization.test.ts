import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { apiRateLimits, waitlistContacts } from '../src/schema.js';
import { rateLimitRepo } from '../src/repositories/rate-limit.js';
import { waitlistRepo } from '../src/repositories/waitlist.js';
import { createTestDb, type TestDb } from './setup.js';

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  if (t) await t.dispose();
});

describe('shared durable abuse counter', () => {
  it('admits exactly ten concurrent requests and resets at the next minute', async () => {
    const start = new Date('2026-09-30T03:00:00Z');
    const key = 'a'.repeat(64);
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        rateLimitRepo.consume(t.db, key, start, 10, new Date(start.getTime() + 1000)),
      ),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    expect(results.filter((r) => !r.allowed)).toHaveLength(2);
    expect(results[0]?.retryAfterSeconds).toBe(59);
    const next = new Date(start.getTime() + 60_000);
    expect((await rateLimitRepo.consume(t.db, key, next, 10, next)).allowed).toBe(true);
    expect((await rateLimitRepo.consume(t.db, key, start, 10, next)).allowed).toBe(false);
    const [row] = await t.db.select().from(apiRateLimits).where(eq(apiRateLimits.key, key));
    expect(row?.count).toBe(1);
    expect(row?.windowStart).toEqual(next);
  });

  it('isolates different hashed IP keys and prunes expired counters', async () => {
    const now = new Date('2026-09-30T05:00:00Z');
    const old = new Date(now.getTime() - 2 * 86_400_000);
    await rateLimitRepo.consume(t.db, 'b'.repeat(64), old, 1, old);
    expect((await rateLimitRepo.consume(t.db, 'c'.repeat(64), now, 1, now)).allowed).toBe(true);
    await rateLimitRepo.prune(t.db, now);
    const rows = await t.db.select().from(apiRateLimits);
    expect(rows.some((r) => r.key === 'b'.repeat(64))).toBe(false);
    expect(rows.some((r) => r.key === 'c'.repeat(64))).toBe(true);
  });

  it('rejects raw IP keys and invalid limits', async () => {
    const start = new Date('2026-09-30T03:00:00Z');
    await expect(rateLimitRepo.consume(t.db, '127.0.0.1', start, 10)).rejects.toThrow();
    await expect(rateLimitRepo.consume(t.db, 'd'.repeat(64), start, 0)).rejects.toThrow();
  });
});

describe('waitlist persistence', () => {
  it('normalizes repeated emails without discarding original consent', async () => {
    const one = await waitlistRepo.register(t.db, {
      email: '  TEST@example.com ',
      source: 'prices',
      consentVersion: 'v1',
    });
    const two = await waitlistRepo.register(t.db, {
      email: 'test@example.com',
      source: 'other',
      consentVersion: 'v2',
    });
    expect(two).toEqual(one);
    const rows = await t.db.select().from(waitlistContacts);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: 'test@example.com',
      source: 'prices',
      consentVersion: 'v1',
    });
    expect(rows[0]?.consentedAt).toBeInstanceOf(Date);
  });
});
