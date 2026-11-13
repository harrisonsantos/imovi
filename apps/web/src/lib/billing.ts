export type BillingProduct = 'audit' | 'corretor_pro';
export type BillingPlanId =
  | 'audit-essencial'
  | 'audit-profissional'
  | 'audit-escala'
  | 'corretor_pro';

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  priceMonthly: number;
  maxCorretores: number | null;
  priceEnv: string;
  product: BillingProduct;
  entitlements: { monthlyEstimatesQuota: number | null; ads: boolean; history: boolean };
}

export const BILLING_PLANS: readonly BillingPlan[] = [
  {
    id: 'audit-essencial',
    product: 'audit',
    entitlements: { monthlyEstimatesQuota: null, ads: true, history: false },
    name: 'Essencial',
    priceMonthly: 149,
    maxCorretores: 5,
    priceEnv: 'STRIPE_PRICE_AUDIT_ESSENCIAL',
  },
  {
    id: 'audit-profissional',
    product: 'audit',
    entitlements: { monthlyEstimatesQuota: null, ads: true, history: false },
    name: 'Profissional',
    priceMonthly: 299,
    maxCorretores: 15,
    priceEnv: 'STRIPE_PRICE_AUDIT_PROFISSIONAL',
  },
  {
    id: 'audit-escala',
    product: 'audit',
    entitlements: { monthlyEstimatesQuota: null, ads: true, history: false },
    name: 'Escala',
    priceMonthly: 499,
    maxCorretores: null,
    priceEnv: 'STRIPE_PRICE_AUDIT_ESCALA',
  },
  {
    id: 'corretor_pro',
    product: 'corretor_pro',
    name: 'Corretor Pro',
    priceMonthly: 49,
    maxCorretores: 1,
    priceEnv: 'STRIPE_PRICE_CORRETOR_PRO',
    entitlements: { monthlyEstimatesQuota: 100, ads: false, history: true },
  },
] as const;

export function getBillingPlan(value: unknown): BillingPlan | null {
  if (typeof value !== 'string') return null;
  return BILLING_PLANS.find((plan) => plan.id === value) ?? null;
}

export function mapStripeStatus(status: string): string {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due') return 'past_due';
  if (['canceled', 'unpaid', 'paused', 'incomplete_expired'].includes(status)) {
    return 'suspended';
  }
  return 'pending';
}

export function parseStripeSignature(
  header: string,
): { timestamp: number; signatures: string[] } | null {
  const parts = header.split(',').map((part) => part.trim().split('='));
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
  const signatures = parts
    .filter(([key, value]) => key === 'v1' && Boolean(value))
    .map(([, value]) => value!);
  if (!Number.isFinite(timestamp) || signatures.length === 0) return null;
  return { timestamp, signatures };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): Promise<boolean> {
  const parsed = parseStripeSignature(header);
  if (!parsed || Math.abs(nowSeconds - parsed.timestamp) > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${parsed.timestamp}.${payload}`),
  );
  const expected = bytesToHex(new Uint8Array(digest));
  return parsed.signatures.some((signature) => safeEqual(signature, expected));
}

export function appUrlFromRequest(req: Request, configured?: string): string {
  if (configured) return configured.replace(/\/$/, '');
  return new URL(req.url).origin;
}

export function hasTrustedOrigin(req: Request, appUrl: string): boolean {
  const origin = req.headers.get('origin');
  return origin !== null && origin === new URL(appUrl).origin;
}
