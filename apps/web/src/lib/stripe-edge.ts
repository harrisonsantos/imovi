import type { BillingPlan } from './billing';

export interface StripeSession {
  id: string;
  url: string | null;
  status?: string;
  subscription?: string | null;
  customer?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string>;
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
    signal: AbortSignal.timeout(15_000),
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

export function buildCheckoutRequest(input: {
  priceId: string;
  plan: BillingPlan;
  organizationId: string;
  customerId?: string | null;
  customerEmail: string;
  appUrl: string;
  checkoutToken: string;
  expiresAt: Date;
}): Record<string, string> {
  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': input.priceId,
    'line_items[0][quantity]': '1',
    success_url: `${input.appUrl}/auditoria/assinatura?checkout=success`,
    cancel_url: `${input.appUrl}/auditoria/assinatura?checkout=cancelled`,
    client_reference_id: input.organizationId,
    'metadata[organization_id]': input.organizationId,
    'metadata[plan_id]': input.plan.id,
    'metadata[checkout_token]': input.checkoutToken,
    expires_at: String(Math.floor(input.expiresAt.getTime() / 1000)),
    'subscription_data[metadata][organization_id]': input.organizationId,
    'subscription_data[metadata][plan_id]': input.plan.id,
    'subscription_data[metadata][checkout_token]': input.checkoutToken,
    allow_promotion_codes: 'true',
  });
  if (input.customerId) params.set('customer', input.customerId);
  else params.set('customer_email', input.customerEmail);

  return Object.fromEntries(params);
}

export async function createCheckoutSession(input: {
  secretKey: string;
  organizationId: string;
  checkoutToken: string;
  request: Record<string, string>;
}): Promise<StripeSession> {
  return stripePost<StripeSession>(
    input.secretKey,
    'checkout/sessions',
    new URLSearchParams(
      Object.entries(input.request).sort(([left], [right]) => left.localeCompare(right)),
    ),
    `checkout:${input.organizationId}:${input.checkoutToken}`,
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

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  metadata: Record<string, string>;
  current_period_end?: number;
  cancel_at_period_end: boolean;
  items?: { data: Array<{ current_period_end?: number; price?: { id: string } }> };
}

export async function retrieveSubscription(
  secretKey: string,
  subscriptionId: string,
): Promise<StripeSubscription> {
  const response = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) throw new Error('Stripe reconciliation unavailable');
  return (await response.json()) as StripeSubscription;
}

export async function retrieveCheckoutSession(
  secretKey: string,
  sessionId: string,
): Promise<StripeSession> {
  const response = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) throw new Error('Stripe checkout lookup unavailable');
  return (await response.json()) as StripeSession;
}
