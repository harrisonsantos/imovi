import { billingRepo } from '@imovi/db/billing';
import { getBillingPlan, mapStripeStatus, verifyStripeSignature } from '@/lib/billing';
import { getCfEnv } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';

export const runtime = 'edge';

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function metadataOf(object: Record<string, unknown>): Record<string, string> {
  const value = object.metadata;
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

async function applyEvent(db: ReturnType<typeof getDb>, event: StripeEvent): Promise<void> {
  const object = event.data.object;
  const customerId = stringValue(object.customer);
  if (!customerId) return;
  const metadata = metadataOf(object);

  if (event.type === 'checkout.session.completed') {
    const organizationId = stringValue(object.client_reference_id) ?? metadata.organization_id;
    if (!organizationId) return;
    const plan = getBillingPlan(metadata.plan_id);
    await billingRepo.updateOrg(db, {
      organizationId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: stringValue(object.subscription),
      ...(plan ? { plan: plan.id, maxCorretores: plan.maxCorretores } : {}),
      status:
        object.payment_status === 'paid' || object.payment_status === 'no_payment_required'
          ? 'active'
          : 'pending',
    });
    return;
  }

  if (event.type.startsWith('customer.subscription.')) {
    const organizationId = metadata.organization_id;
    const plan = getBillingPlan(metadata.plan_id);
    const periodEnd =
      typeof object.current_period_end === 'number'
        ? new Date(object.current_period_end * 1000)
        : null;
    await billingRepo.updateOrg(db, {
      ...(organizationId ? { organizationId } : {}),
      stripeCustomerId: customerId,
      stripeSubscriptionId: stringValue(object.id),
      ...(plan ? { plan: plan.id, maxCorretores: plan.maxCorretores } : {}),
      status: mapStripeStatus(String(object.status ?? 'canceled')),
      subscriptionCurrentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: object.cancel_at_period_end === true,
    });
    return;
  }

  if (event.type === 'invoice.paid') {
    await billingRepo.updateOrg(db, { stripeCustomerId: customerId, status: 'active' });
  } else if (event.type === 'invoice.payment_failed') {
    await billingRepo.updateOrg(db, { stripeCustomerId: customerId, status: 'past_due' });
  }
}

export async function POST(req: Request): Promise<Response> {
  const cfEnv = await getCfEnv();
  const webhookSecret = cfEnv.STRIPE_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return apiError(503, 'billing_unavailable', 'Webhook não configurado.');

  const signature = req.headers.get('stripe-signature');
  const payload = await req.text();
  if (!signature || !(await verifyStripeSignature(payload, signature, webhookSecret))) {
    return apiError(400, 'invalid_signature', 'Assinatura Stripe inválida.');
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return apiError(400, 'invalid_json', 'Evento Stripe inválido.');
  }
  if (!event.id || !event.type || !event.data?.object) {
    return apiError(400, 'invalid_event', 'Contrato do evento Stripe inválido.');
  }

  const db = getDb(cfEnv.DATABASE_URL);
  const claimed = await billingRepo.claimEvent(db, event.id, event.type);
  if (!claimed) return Response.json({ received: true, duplicate: true });

  try {
    await applyEvent(db, event);
    return Response.json({ received: true });
  } catch (err) {
    await billingRepo.releaseEvent(db, event.id);
    console.error('[billing/webhook] falha ao processar evento:', event.id, event.type, err);
    return apiError(500, 'webhook_processing_failed', 'Falha ao processar evento.');
  }
}
