import type { Organization } from '@imovi/db/schema-auth';
import type { AuthEnv } from './auth.js';
import { getBillingPlan, type BillingPlan } from './billing.js';
import {
  assertOrgAccess,
  requireOrgIdentity,
  requireSession,
  SessionError,
  type SessionInfo,
} from './session.js';

export interface EstimateAccess {
  session: SessionInfo | null;
  org: Organization | null;
  plan: BillingPlan | null;
}

/** Resolve current membership and paid rights; infrastructure errors must never downgrade a Pro request. */
export async function resolveEstimateAccess(req: Request, env: AuthEnv): Promise<EstimateAccess> {
  const access: EstimateAccess = { session: null, org: null, plan: null };
  if (!req.headers.has('cookie')) return access;
  try {
    access.session = await requireSession(req, env);
  } catch (error) {
    if (error instanceof SessionError && error.status === 401) return access;
    throw error;
  }
  if (!access.session.activeOrganizationId) return access;
  try {
    const identity = await requireOrgIdentity(req, env);
    access.org = identity.org;
    const plan = getBillingPlan(identity.org.plan);
    if (plan?.product !== 'corretor_pro') return access;
    assertOrgAccess(identity.org, new Date(), 'corretor_pro');
    access.plan = plan;
  } catch (error) {
    if (
      !(error instanceof SessionError) ||
      ![
        'no_organization',
        'membership_required',
        'subscription_required',
        'trial_expired',
      ].includes(error.code)
    )
      throw error;
  }
  return access;
}
