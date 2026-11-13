import { describe, it, expect } from 'vitest';
import { publicEstimateOf, sourceDescription } from '../src/lib/public-estimate';

const row = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  estimate: '620000.00',
  confidenceLow: '434000.00',
  confidenceHigh: '806000.00',
  modelVersion: 'heuristic-v0',
  featuresUsed: { areaM2: 62, neighborhoodPriceM2: 10000 },
  inputPayload: {
    city: 'Curitiba',
    state: 'PR',
    neighborhood: 'Batel',
    area: 62,
    propertyType: 'apartment',
    turnstileToken: 'secret-token',
    email: 'private@example.test',
  },
  requestedBy: 'private-id',
  resultMetadata: {
    method: 'heuristic',
    neighborhood: { name: 'Batel', medianPriceM2: 10000 },
    generatedAt: '2026-09-30T12:00:00.000Z',
    dataSource: { kind: 'seed_reference', sampleCount: 0, updatedAt: null },
  },
};

describe('saved public estimates', () => {
  it('reproduces the historical snapshot and omits tokens and personal fields', () => {
    const result = publicEstimateOf(row);
    expect(result?.estimate).toBe(620000);
    expect(result?.featuresUsed.areaM2).toBe(62);
    expect(result?.property).toEqual({
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Batel',
      area: 62,
      propertyType: 'apartment',
    });
    expect(result?.neighborhood.medianPriceM2).toBe(10000);
    expect(result?.generatedAt).toBe('2026-09-30T12:00:00.000Z');
    expect(JSON.stringify(result)).not.toContain('secret-token');
    expect(JSON.stringify(result)).not.toContain('private');
  });
  it('does not invent metadata for legacy or corrupt rows', () => {
    expect(publicEstimateOf({ ...row, resultMetadata: null })).toBeNull();
    expect(publicEstimateOf({ ...row, estimate: 'invalid' })).toBeNull();
  });
  it('describes seed references and small samples honestly', () => {
    expect(
      sourceDescription({ kind: 'seed_reference', sampleCount: 0, updatedAt: null }),
    ).toContain('aproximada');
    expect(
      sourceDescription({ kind: 'insufficient_data', sampleCount: 19, updatedAt: null }),
    ).toContain('mínimo de 20');
  });
});
