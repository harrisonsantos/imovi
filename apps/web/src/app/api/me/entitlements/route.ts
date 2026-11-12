import { usageCounterRepo } from '@imovi/db/rate-limit';
import { getBillingPlan } from '@/lib/billing';
import { getCfEnv } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { resolveEstimateAccess } from '@/lib/entitlements';
import { apiError } from '@/lib/errors';
import { SessionError, sessionGuard } from '@/lib/session';

export async function GET(req: Request): Promise<Response> {
  try {
    const env = await getCfEnv();
    const access = await resolveEstimateAccess(req, env);
    let quota = null;
    if (access.plan && access.org) {
      const limit = access.plan.entitlements.monthlyEstimatesQuota!;
      const usage = await usageCounterRepo.getMonthlyUsage(getDb(env.DATABASE_URL), {
        orgId: access.org.id,
        metric: 'estimates',
      });
      quota = {
        limit,
        used: usage.count,
        remaining: Math.max(0, limit - usage.count),
        renewsAt: usage.renewsAt,
      };
    }
    return Response.json(
      {
        authenticated: access.session !== null,
        product: access.org ? (getBillingPlan(access.org.plan)?.product ?? 'audit') : null,
        plan: access.org?.plan ?? null,
        ads: access.plan?.entitlements.ads ?? true,
        history: access.plan?.entitlements.history ?? false,
        quota,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof SessionError) return sessionGuard(error);
    return apiError(503, 'entitlements_unavailable', 'Não foi possível consultar seu plano.');
  }
}
