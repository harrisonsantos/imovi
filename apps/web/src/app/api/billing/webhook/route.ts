import { orgRepo } from '@imovi/db/orgs';
import { retrieveSubscription } from '@/lib/stripe-edge';
import { billingRepo } from '@imovi/db/billing';
import { BILLING_PLANS, mapStripeStatus, verifyStripeSignature } from '@/lib/billing';
import { getCfEnv } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';

export const runtime = 'edge';

interface StripeEvent {
  id: string;
  type: string;
  created: number;
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

async function reconcileEvent(
  db: ReturnType<typeof getDb>,
  event: StripeEvent,
  token: string,
  env: Record<string, string>,
  secretKey: string,
): Promise<void> {
  const supported =
    event.type === 'checkout.session.completed' ||
    event.type.startsWith('customer.subscription.') ||
    event.type === 'invoice.paid' ||
    event.type === 'invoice.payment_failed';
  if (!supported) return billingRepo.completeEvent(db, event.id, token);
  const object = event.data.object;
  const customerId = stringValue(object.customer);
  if (!customerId) throw new Error('Customer missing');
  const metadata = metadataOf(object);
  const organizationId = stringValue(object.client_reference_id) ?? metadata.organization_id;
  const org = organizationId
    ? await orgRepo.findById(db, organizationId)
    : await billingRepo.findOrgByCustomer(db, customerId);
  if (!org || (org.stripeCustomerId && org.stripeCustomerId !== customerId))
    throw new Error('Billing organization mismatch');
  const leased = await billingRepo.acquireOrgLease(db, org.id, token);
  if (!leased) throw new Error('Billing organization busy');
  try {
    if (leased.stripeCustomerId && leased.stripeCustomerId !== customerId)
      throw new Error('Customer mismatch');
    // Invoice status is never an authority for subscription entitlement.
    const parent = object.parent as
      | { subscription_details?: { subscription?: unknown } }
      | undefined;
    let subscriptionId = event.type.startsWith('customer.subscription.')
      ? stringValue(object.id)
      : (stringValue(object.subscription) ??
        stringValue(parent?.subscription_details?.subscription) ??
        leased.stripeSubscriptionId);
    const expectedCheckout = Boolean(
      leased.billingCheckoutToken &&
      metadata.checkout_token === leased.billingCheckoutToken &&
      (event.type !== 'checkout.session.completed' ||
        !leased.billingCheckoutSessionId ||
        leased.billingCheckoutSessionId === object.id),
    );
    if (
      event.type === 'checkout.session.completed' &&
      !expectedCheckout &&
      !leased.stripeSubscriptionId
    ) {
      throw new Error('Checkout not expected');
    }
    if (leased.stripeSubscriptionId && leased.stripeSubscriptionId !== subscriptionId) {
      if (expectedCheckout) {
        // The DB status can lag a canceled subscription. Confirm eligibility from Stripe while holding the org lease.
        const old = await retrieveSubscription(secretKey, leased.stripeSubscriptionId);
        if (
          old.id !== leased.stripeSubscriptionId ||
          old.customer !== customerId ||
          !['canceled', 'incomplete_expired'].includes(old.status)
        ) {
          throw new Error('Existing subscription must be managed in portal');
        }
      } else subscriptionId = leased.stripeSubscriptionId;
    } else if (!leased.stripeSubscriptionId && !expectedCheckout) {
      throw new Error('Subscription not expected');
    }
    if (!subscriptionId) throw new Error('Subscription missing');
    const subscription = await retrieveSubscription(secretKey, subscriptionId);
    if (
      subscription.id !== subscriptionId ||
      subscription.customer !== customerId ||
      subscription.metadata?.organization_id !== org.id
    )
      throw new Error('Subscription mismatch');
    const items = subscription.items?.data ?? [];
    const priceId = items.length === 1 ? items[0]?.price?.id : null;
    const matchingPlans = priceId
      ? BILLING_PLANS.filter(
          (candidate) => priceId === (env[candidate.priceEnv] ?? process.env[candidate.priceEnv]),
        )
      : [];
    const plan = matchingPlans.length === 1 ? matchingPlans[0] : null;
    if (!plan) throw new Error('Subscription price not configured');
    if (
      expectedCheckout &&
      (subscription.metadata?.checkout_token !== leased.billingCheckoutToken ||
        (leased.billingCheckoutPlanId && plan.id !== leased.billingCheckoutPlanId))
    ) {
      throw new Error('Subscription checkout mismatch');
    }
    const end = subscription.current_period_end ?? subscription.items?.data[0]?.current_period_end;
    await billingRepo.completeEvent(
      db,
      event.id,
      token,
      {
        organizationId: org.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        plan: plan.id,
        maxCorretores: plan.maxCorretores,
        status: mapStripeStatus(subscription.status),
        subscriptionCurrentPeriodEnd: typeof end === 'number' ? new Date(end * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
        ...(expectedCheckout ? { expectedCheckoutToken: leased.billingCheckoutToken! } : {}),
        ...(expectedCheckout && event.type === 'checkout.session.completed'
          ? { checkoutToken: leased.billingCheckoutToken! }
          : {}),
      },
      new Date(event.created * 1000),
    );
  } catch (error) {
    await billingRepo.releaseEvent(db, event.id, token, org.id);
    throw error;
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
  if (
    !event ||
    typeof event !== 'object' ||
    typeof event.id !== 'string' ||
    !event.id ||
    typeof event.type !== 'string' ||
    !event.type ||
    !Number.isInteger(event.created) ||
    event.created < 0 ||
    !event.data?.object ||
    typeof event.data.object !== 'object' ||
    Array.isArray(event.data.object)
  ) {
    return apiError(400, 'invalid_event', 'Contrato do evento Stripe inválido.');
  }

  const secretKey = cfEnv.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return apiError(503, 'billing_unavailable', 'Reconciliação não configurada.');
  const db = getDb(cfEnv.DATABASE_URL);
  const token = crypto.randomUUID();
  try {
    const claimed = await billingRepo.claimEvent(
      db,
      event.id,
      event.type,
      event as unknown as Record<string, unknown>,
      token,
    );
    if (claimed === 'processed') return Response.json({ received: true, duplicate: true });
    if (claimed === 'busy')
      return apiError(503, 'webhook_busy', 'Evento em processamento; tente novamente.');
    await reconcileEvent(db, event, token, cfEnv, secretKey);
    return Response.json({ received: true });
  } catch {
    await billingRepo.releaseEvent(db, event.id, token).catch(() => undefined);
    console.error('[billing/webhook] reconciliação não concluída');
    return apiError(500, 'webhook_processing_failed', 'Falha ao processar evento.');
  }
}
