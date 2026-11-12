import { eq, lt, sql } from 'drizzle-orm';
import { apiRateLimits } from '../schema.js';
import type { AnyDbClient } from './types.js';
// Available through the existing edge-safe package subpath.
export { usageCounterRepo } from './usage-counters.js';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export const rateLimitRepo = {
  /** Atomic PostgreSQL upsert: concurrent isolates share the same counter. */
  async consume(
    db: AnyDbClient,
    key: string,
    windowStart: Date,
    limit: number,
    now: Date = new Date(),
  ): Promise<RateLimitResult> {
    if (
      !/^[a-f0-9]{64}$/.test(key) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 1000 ||
      !Number.isFinite(windowStart.getTime()) ||
      windowStart.getTime() % 60_000 !== 0
    ) {
      throw new Error('Invalid rate-limit configuration');
    }
    const [row] = await db
      .insert(apiRateLimits)
      .values({ key, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: apiRateLimits.key,
        set: {
          windowStart: sql`greatest(${apiRateLimits.windowStart}, excluded.window_start)`,
          count: sql`case when ${apiRateLimits.windowStart} < excluded.window_start then 1 else ${apiRateLimits.count} + 1 end`,
        },
        setWhere: sql`${apiRateLimits.windowStart} <= excluded.window_start`,
      })
      .returning();
    // An old request cannot reset a newer window or consume its capacity.
    const current =
      row ?? (await db.select().from(apiRateLimits).where(eq(apiRateLimits.key, key)).limit(1))[0];
    if (!current) throw new Error('Rate limiter unavailable');
    return {
      allowed: row !== undefined && current.count <= limit,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.windowStart.getTime() + 60_000 - now.getTime()) / 1000),
      ),
    };
  },

  /** Bound retention of pseudonymous abuse counters to one day. */
  async prune(db: AnyDbClient, now: Date = new Date()): Promise<void> {
    await db
      .delete(apiRateLimits)
      .where(lt(apiRateLimits.windowStart, new Date(now.getTime() - 86_400_000)));
  },
};
