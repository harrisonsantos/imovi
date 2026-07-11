import { apiError } from '@/lib/errors';
import { authEnvOf, getCfEnv } from '@/lib/cf-env';
import { appUrlFromRequest, hasTrustedOrigin } from '@/lib/billing';
import { requireOrgIdentity, sessionGuard } from '@/lib/session';
import { createPortalSession } from '@/lib/stripe-edge';

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

  try {
    const info = await requireOrgIdentity(req, authEnvOf(cfEnv));
    const secretKey = cfEnv.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
    if (!secretKey || !info.org.stripeCustomerId) {
      return apiError(409, 'no_billing_account', 'Nenhuma assinatura encontrada para esta conta.');
    }
    const session = await createPortalSession({
      secretKey,
      customerId: info.org.stripeCustomerId,
      appUrl,
    });
    if (!session.url) return apiError(502, 'stripe_error', 'Portal sem URL de redirecionamento.');
    return Response.json({ url: session.url });
  } catch (err) {
    try {
      return sessionGuard(err);
    } catch {
      console.error('[billing/portal] falha ao criar portal:', err);
      return apiError(502, 'stripe_error', 'Não foi possível abrir o portal de cobrança.');
    }
  }
}
