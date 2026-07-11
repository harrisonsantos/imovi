import type { BillingPlan } from './billing';

interface StripeSession {
  id: string;
  url: string | null;
}

interface StripeErrorBody {
  error?: { message?: string };
}

async function stripePost<T>(
  secretKey: string,
  path: string,
  params: URLSearchParams,
  idempotencyKey?: string,
): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: params,
  });
  const body = (await res.json().catch(() => null)) as (T & StripeErrorBody) | null;
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `Stripe retornou HTTP ${res.status}`);
  }
  if (!body) throw new Error('Stripe retornou uma resposta vazia.');
  return body;
}

export async function createCheckoutSession(input: {
  secretKey: string;
  priceId: string;
  plan: BillingPlan;
  organizationId: string;
  customerId?: string | null;
  customerEmail: string;
  appUrl: string;
}): Promise<StripeSession> {
  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': input.priceId,
    'line_items[0][quantity]': '1',
    success_url: `${input.appUrl}/auditoria/assinatura?checkout=success`,
    cancel_url: `${input.appUrl}/auditoria/assinatura?checkout=cancelled`,
    client_reference_id: input.organizationId,
    'metadata[organization_id]': input.organizationId,
    'metadata[plan_id]': input.plan.id,
    'subscription_data[metadata][organization_id]': input.organizationId,
    'subscription_data[metadata][plan_id]': input.plan.id,
    allow_promotion_codes: 'true',
  });
  if (input.customerId) params.set('customer', input.customerId);
  else params.set('customer_email', input.customerEmail);

  return stripePost<StripeSession>(
    input.secretKey,
    'checkout/sessions',
    params,
    `checkout:${input.organizationId}:${input.plan.id}:${Math.floor(Date.now() / 600_000)}`,
  );
}

export async function createPortalSession(input: {
  secretKey: string;
  customerId: string;
  appUrl: string;
}): Promise<StripeSession> {
  return stripePost<StripeSession>(
    input.secretKey,
    'billing_portal/sessions',
    new URLSearchParams({
      customer: input.customerId,
      return_url: `${input.appUrl}/auditoria/assinatura`,
    }),
  );
}
