import { billingRepo } from '@imovi/db/billing';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';
import { authEnvOf, getCfEnv } from '@/lib/cf-env';
import { appUrlFromRequest, getBillingPlan, hasTrustedOrigin } from '@/lib/billing';
import { requireOrgAdminIdentity, sessionGuard } from '@/lib/session';
import {
  buildCheckoutRequest,
  createCheckoutSession,
  retrieveCheckoutSession,
  retrieveSubscription,
} from '@/lib/stripe-edge';


export async function POST(req: Request): Promise<Response> {
  const cfEnv = await getCfEnv();
  const appUrl = appUrlFromRequest(
    req,
    cfEnv.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  );
  if (!hasTrustedOrigin(req, appUrl)) {
    return apiError(403, 'invalid_origin', 'Origem da requisição não permitida.');
  }

  let body: { planId?: unknown };
  try {
    body = (await req.json()) as { planId?: unknown };
  } catch {
    return apiError(400, 'invalid_json', 'Body deve ser JSON válido.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return apiError(400, 'invalid_plan', 'Plano de assinatura inválido.');
  }
  const plan = getBillingPlan(body.planId);
  if (!plan) return apiError(400, 'invalid_plan', 'Plano de assinatura inválido.');

  try {
    const info = await requireOrgAdminIdentity(req, authEnvOf(cfEnv));
    const secretKey = cfEnv.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
    const priceId = cfEnv[plan.priceEnv] ?? process.env[plan.priceEnv];
    if (!secretKey || !priceId) {
      return apiError(503, 'billing_unavailable', 'Cobrança ainda não configurada.');
    }

    const db = getDb(cfEnv.DATABASE_URL);
    const leaseToken = crypto.randomUUID();
    const org = await billingRepo.acquireOrgLease(db, info.org.id, leaseToken);
    if (!org)
      return apiError(
        409,
        'billing_busy',
        'Cobrança em atualização. Tente novamente em instantes.',
      );
    try {
      if (org.stripeSubscriptionId) {
        const current = await retrieveSubscription(secretKey, org.stripeSubscriptionId);
        if (current.id !== org.stripeSubscriptionId || current.customer !== org.stripeCustomerId) {
          return apiError(409, 'billing_mismatch', 'Conta de cobrança precisa de reconciliação.');
        }
        if (!['canceled', 'incomplete_expired'].includes(current.status)) {
          return apiError(
            409,
            'subscription_exists',
            'Gerencie sua assinatura atual no portal de cobrança.',
          );
        }
      }
      let checkoutToken = org.billingCheckoutToken;
      let expiresAt = org.billingCheckoutExpiresAt;
      let checkoutRequest = org.billingCheckoutRequest;
      if (checkoutToken && org.billingCheckoutSessionId) {
        const existing = await retrieveCheckoutSession(secretKey, org.billingCheckoutSessionId);
        if (
          existing.id !== org.billingCheckoutSessionId ||
          existing.metadata?.checkout_token !== checkoutToken ||
          existing.metadata?.organization_id !== org.id ||
          (org.stripeCustomerId && existing.customer !== org.stripeCustomerId)
        ) {
          return apiError(409, 'billing_mismatch', 'Checkout precisa de reconciliação.');
        }
        if (existing.status === 'open') {
          if (org.billingCheckoutPlanId !== plan.id)
            return apiError(
              409,
              'checkout_pending',
              'Conclua ou aguarde expirar o checkout iniciado antes de escolher outro plano.',
            );
          if (!existing.url) return apiError(502, 'stripe_error', 'Checkout sem URL.');
          return Response.json({ url: existing.url });
        }
        if (existing.status === 'complete') {
          if (!existing.subscription)
            return apiError(409, 'checkout_pending', 'Pagamento em reconciliação.');
          const completed = await retrieveSubscription(secretKey, existing.subscription);
          if (
            completed.id !== existing.subscription ||
            completed.customer !== existing.customer ||
            completed.metadata?.organization_id !== org.id ||
            completed.metadata?.checkout_token !== checkoutToken
          ) {
            return apiError(409, 'billing_mismatch', 'Checkout precisa de reconciliação.');
          }
          if (!['canceled', 'incomplete_expired'].includes(completed.status))
            return apiError(
              409,
              'checkout_pending',
              'Pagamento concluído. Aguarde a atualização ou acesse o portal de cobrança.',
            );
        } else if (existing.status !== 'expired')
          return apiError(409, 'checkout_pending', 'Checkout em reconciliação.');
        checkoutToken = null;
        expiresAt = null;
        checkoutRequest = null;
      }
      if (checkoutToken && org.billingCheckoutPlanId !== plan.id) {
        return apiError(409, 'checkout_pending', 'Há um checkout em recuperação para outro plano.');
      }
      if (!checkoutToken) {
        checkoutToken = crypto.randomUUID();
        expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        checkoutRequest = buildCheckoutRequest({
          priceId,
          plan,
          organizationId: org.id,
          customerId: org.stripeCustomerId,
          customerEmail: info.email,
          appUrl,
          checkoutToken,
          expiresAt,
        });
        await billingRepo.beginCheckout(
          db,
          org.id,
          leaseToken,
          checkoutToken,
          plan.id,
          expiresAt,
          checkoutRequest,
        );
      }
      // A persisted attempt with no session ID retries the exact Stripe request/key after a crash.
      // It is never cleared on a timeout: Stripe may already have created the session.
      if (!expiresAt || !checkoutRequest)
        return apiError(409, 'checkout_pending', 'Checkout precisa de recuperação.');
      const session = await createCheckoutSession({
        secretKey,
        organizationId: org.id,
        checkoutToken,
        request: checkoutRequest,
      });
      if (!session.id) throw new Error('Stripe checkout ID missing');
      await billingRepo.saveCheckoutSession(db, org.id, leaseToken, checkoutToken, session.id);
      if (!session.url || session.status === 'complete' || session.status === 'expired') {
        return apiError(
          409,
          'checkout_pending',
          'Checkout concluído ou expirado. Tente novamente para reconciliar.',
        );
      }
      return Response.json({ url: session.url });
    } finally {
      await billingRepo.releaseOrgLease(db, org.id, leaseToken);
    }
  } catch (err) {
    try {
      return sessionGuard(err);
    } catch {
      console.error('[billing/checkout] falha ao criar checkout');
      return apiError(502, 'stripe_error', 'Não foi possível iniciar o checkout.');
    }
  }
}
