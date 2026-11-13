import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createTestDb, type TestDb } from './setup.js';
import { usageCounterRepo, estimateRepo } from '../src/index.js';
import { organizations, users } from '../src/schema-auth.js';
import { orgRepo } from '../src/repositories/orgs.js';

describe('monthly entitlements (AC-P2, AC-P3, AC-P5)', () => {
  let t: TestDb;
  const now = new Date('2026-12-31T23:59:59.999Z');
  beforeEach(async () => {
    t = await createTestDb();
    await t.db.insert(organizations).values([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
    await t.db.insert(users).values([
      { id: 'alice', name: 'Alice', email: 'alice@example.test' },
      { id: 'bob', name: 'Bob', email: 'bob@example.test' },
    ]);
  });
  afterEach(async () => t.dispose());

  it('accepts exactly 50 of 100 concurrent requests and keeps rejected counts at 50', async () => {
    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        usageCounterRepo.consumeMonthlyQuota(t.db, {
          orgId: 'a',
          metric: 'estimates',
          limit: 50,
          now,
        }),
      ),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(50);
    expect(
      results.filter((r) => !r.allowed).every((r) => r.count === 50 && r.remaining === 0),
    ).toBe(true);
    expect(
      await usageCounterRepo.getMonthlyUsage(t.db, { orgId: 'a', metric: 'estimates', now }),
    ).toMatchObject({ count: 50 });
  });

  it('resets at UTC month/year rollover without deleting the previous month', async () => {
    const input = { orgId: 'a', metric: 'estimates', limit: 1, now };
    expect(await usageCounterRepo.consumeMonthlyQuota(t.db, input)).toMatchObject({
      allowed: true,
      remaining: 0,
      periodStart: new Date('2026-12-01Z'),
      renewsAt: new Date('2027-01-01Z'),
    });
    const next = new Date('2027-01-01T00:00:00Z');
    expect(await usageCounterRepo.getMonthlyUsage(t.db, { ...input, now: next })).toMatchObject({
      count: 0,
    });
    expect(await usageCounterRepo.consumeMonthlyQuota(t.db, { ...input, now: next })).toMatchObject(
      { allowed: true, count: 1 },
    );
    expect(await usageCounterRepo.getMonthlyUsage(t.db, input)).toMatchObject({ count: 1 });
    expect((await t.raw.query('SELECT * FROM usage_counters')).rows).toHaveLength(2);
  });

  it('isolates organizations and metrics and preserves usage on quota changes', async () => {
    const input = { orgId: 'a', metric: 'estimates', limit: 1, now };
    await usageCounterRepo.consumeMonthlyQuota(t.db, input);
    expect(await usageCounterRepo.consumeMonthlyQuota(t.db, { ...input, limit: 2 })).toMatchObject({
      allowed: true,
      count: 2,
    });
    expect(await usageCounterRepo.consumeMonthlyQuota(t.db, input)).toMatchObject({
      allowed: false,
      count: 2,
    });
    expect(
      await usageCounterRepo.consumeMonthlyQuota(t.db, { ...input, orgId: 'b' }),
    ).toMatchObject({ count: 1, allowed: true });
    expect(
      await usageCounterRepo.consumeMonthlyQuota(t.db, { ...input, metric: 'other' }),
    ).toMatchObject({ count: 1, allowed: true });
    expect(await usageCounterRepo.consumeMonthlyQuota(t.db, { ...input, limit: 0 })).toMatchObject({
      allowed: false,
    });
    await expect(
      usageCounterRepo.consumeMonthlyQuota(t.db, { ...input, limit: -1 }),
    ).rejects.toThrow();
  });

  it('lists only owned estimates, newest first, with bounded pagination and nullable ownership', async () => {
    const row = { inputPayload: { area: 42 }, modelVersion: 'heuristic-v0' };
    const old = await estimateRepo.record(t.db, {
      ...row,
      ownerUserId: 'alice',
      createdAt: new Date('2026-01-01Z'),
    });
    const recent = await estimateRepo.record(t.db, {
      ...row,
      ownerUserId: 'alice',
      createdAt: now,
    });
    await estimateRepo.record(t.db, { ...row, ownerUserId: 'bob' });
    await estimateRepo.record(t.db, row);
    expect((await estimateRepo.listByOwnerUserId(t.db, 'alice')).map((r) => r.id)).toEqual([
      recent.id,
      old.id,
    ]);
    expect(
      (await estimateRepo.listByOwnerUserId(t.db, 'alice', { limit: 1, offset: 1 })).map(
        (r) => r.id,
      ),
    ).toEqual([old.id]);
    await t.raw.query('DELETE FROM users WHERE id = $1', ['alice']);
    expect((await estimateRepo.findById(t.db, old.id))?.ownerUserId).toBeNull();
    await t.raw.query('DELETE FROM organizations WHERE id = $1', ['a']);
    expect(
      (await t.raw.query('SELECT * FROM usage_counters WHERE org_id = $1', ['a'])).rows,
    ).toEqual([]);
  });

  it('ships identical Postgres and PGlite DDL', async () => {
    const [pg, lite] = await Promise.all(
      ['0012_entitlements.sql', '0012_entitlements_pglite.sql'].map((name) =>
        readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'),
      ),
    );
    expect(pg).toBe(lite);
  });

  it('excludes Pro organizations from background audit processing', async () => {
    await t.raw.query(
      "UPDATE organizations SET plan = 'corretor_pro', status = 'active' WHERE id = 'a'",
    );
    expect((await orgRepo.listActiveForAudit(t.db)).map((org) => org.id)).toEqual(['b']);
  });
});
