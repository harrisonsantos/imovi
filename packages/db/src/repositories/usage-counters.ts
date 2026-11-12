import { and, eq, sql } from 'drizzle-orm';
import { usageCounters } from '../schema.js';
import type { AnyDbClient } from './types.js';

interface MonthlyUsageInput {
  orgId: string;
  metric: string;
  now?: Date;
}

function monthOf(input: MonthlyUsageInput) {
  const now = input.now ?? new Date();
  if (!input.orgId || !input.metric || !Number.isFinite(now.getTime())) {
    throw new Error('Invalid monthly usage configuration');
  }
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const renewsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { now, periodStart, renewsAt };
}

export const usageCounterRepo = {
  async getMonthlyUsage(db: AnyDbClient, input: MonthlyUsageInput) {
    const { periodStart, renewsAt } = monthOf(input);
    const [row] = await db
      .select({ count: usageCounters.count })
      .from(usageCounters)
      .where(
        and(
          eq(usageCounters.orgId, input.orgId),
          eq(usageCounters.metric, input.metric),
          eq(usageCounters.periodStart, periodStart),
        ),
      )
      .limit(1);
    return { count: row?.count ?? 0, periodStart, renewsAt };
  },

  /** One conditional upsert arbitrates concurrent requests. Billing history is never pruned. */
  async consumeMonthlyQuota(db: AnyDbClient, input: MonthlyUsageInput & { limit: number }) {
    const { now, periodStart, renewsAt } = monthOf(input);
    const { limit } = input;
    if (!Number.isInteger(limit) || limit < 0 || limit > 2_147_483_647) {
      throw new Error('Invalid monthly quota');
    }
    const [row] =
      limit === 0
        ? []
        : await db
            .insert(usageCounters)
            .values({
              orgId: input.orgId,
              metric: input.metric,
              periodStart,
              count: 1,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [usageCounters.orgId, usageCounters.metric, usageCounters.periodStart],
              set: { count: sql`${usageCounters.count} + 1`, updatedAt: now },
              setWhere: sql`${usageCounters.count} < ${limit}`,
            })
            .returning({ count: usageCounters.count });
    const count =
      row?.count ?? (await usageCounterRepo.getMonthlyUsage(db, { ...input, now })).count;
    return {
      allowed: row !== undefined,
      count,
      remaining: Math.max(0, limit - count),
      limit,
      periodStart,
      renewsAt,
    };
  },
};
