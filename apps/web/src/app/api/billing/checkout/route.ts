import { apiError } from '@/lib/errors';
import { authEnvOf, getCfEnv } from '@/lib/cf-env';
import { appUrlFromRequest, getBillingPlan, hasTrustedOrigin } from '@/lib/billing';
import { requireOrgIdentity, sessionGuard } from '@/lib/session';
import { createCheckoutSession } from '@/lib/stripe-edge';

export const runtime = 'edge';

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
  const plan = getBillingPlan(body.planId);
  if (!plan) return apiError(400, 'invalid_plan', 'Plano de assinatura inválido.');

  try {
    const info = await requireOrgIdentity(req, authEnvOf(cfEnv));
    const secretKey = cfEnv.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
    const priceId = cfEnv[plan.priceEnv] ?? process.env[plan.priceEnv];
    if (!secretKey || !priceId) {
      return apiError(503, 'billing_unavailable', 'Cobrança ainda não configurada.');
    }

    const session = await createCheckoutSession({
      secretKey,
      priceId,
      plan,
      organizationId: info.org.id,
      customerId: info.org.stripeCustomerId,
      customerEmail: info.email,
      appUrl,
    });
    if (!session.url) return apiError(502, 'stripe_error', 'Checkout sem URL de redirecionamento.');
    return Response.json({ url: session.url });
  } catch (err) {
    try {
      return sessionGuard(err);
    } catch {
      console.error('[billing/checkout] falha ao criar checkout:', err);
      return apiError(502, 'stripe_error', 'Não foi possível iniciar o checkout.');
    }
  }
}
