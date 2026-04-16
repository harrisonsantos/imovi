import { describe, it, expect } from 'vitest';
import { IptuRecordSchema } from '../src/types.js';

describe('IptuRecordSchema', () => {
  const base = {
    source: 'infosimples' as const,
    taxYear: 2026,
    assessedValue: 500_000,
    iptuAmount: 1_234.56,
    rawPayload: {},
    fetchedAt: new Date(),
  };

  it('rejeita taxYear float', () => {
    const result = IptuRecordSchema.safeParse({ ...base, taxYear: 2026.5 });
    expect(result.success).toBe(false);
  });

  it('rejeita source fora do enum', () => {
    const result = IptuRecordSchema.safeParse({
      ...base,
      source: 'inventado',
    });
    expect(result.success).toBe(false);
  });

  it('aceita payload válido', () => {
    const result = IptuRecordSchema.safeParse(base);
    expect(result.success).toBe(true);
  });
});
