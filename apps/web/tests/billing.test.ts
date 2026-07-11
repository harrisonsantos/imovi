import { describe, expect, it } from 'vitest';
import {
  getBillingPlan,
  mapStripeStatus,
  parseStripeSignature,
  verifyStripeSignature,
} from '../src/lib/billing';

describe('billing plans', () => {
  it('aceita somente planos públicos conhecidos', () => {
    expect(getBillingPlan('audit-profissional')?.priceMonthly).toBe(299);
    expect(getBillingPlan('plano-inventado')).toBeNull();
  });

  it('mapeia estados Stripe para o gate local', () => {
    expect(mapStripeStatus('active')).toBe('active');
    expect(mapStripeStatus('trialing')).toBe('active');
    expect(mapStripeStatus('past_due')).toBe('past_due');
    expect(mapStripeStatus('canceled')).toBe('suspended');
    expect(mapStripeStatus('unpaid')).toBe('suspended');
    expect(mapStripeStatus('incomplete')).toBe('pending');
  });
});

describe('Stripe webhook signature', () => {
  it('interpreta timestamp e múltiplas assinaturas', () => {
    expect(parseStripeSignature('t=123,v1=abc,v0=old,v1=def')).toEqual({
      timestamp: 123,
      signatures: ['abc', 'def'],
    });
  });

  it('valida HMAC e rejeita payload alterado ou antigo', async () => {
    const secret = 'whsec_test';
    const timestamp = 1_800_000_000;
    const payload = '{"id":"evt_1"}';
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = Array.from(
      new Uint8Array(
        await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)),
      ),
      (byte) => byte.toString(16).padStart(2, '0'),
    ).join('');
    const header = `t=${timestamp},v1=${signature}`;

    await expect(verifyStripeSignature(payload, header, secret, timestamp + 60)).resolves.toBe(
      true,
    );
    await expect(
      verifyStripeSignature(`${payload}x`, header, secret, timestamp + 60),
    ).resolves.toBe(false);
    await expect(verifyStripeSignature(payload, header, secret, timestamp + 301)).resolves.toBe(
      false,
    );
  });
});
