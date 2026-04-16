import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, type TestDb } from './setup.js';
import { estimateRepo } from '../src/repositories/estimates.js';

describe('estimateRepo.record', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.dispose();
  });

  it('persiste estimativa com model_version, input_payload e features_used; retorna id', async () => {
    const saved = await estimateRepo.record(t.db, {
      inputPayload: { area: 62, bedrooms: 2, cep: '04037-050' },
      estimate: '500000.00',
      confidenceLow: '450000.00',
      confidenceHigh: '550000.00',
      modelVersion: 'v1.0.0',
      featuresUsed: { used: ['area', 'bedrooms', 'neighborhood_median'] },
    });

    expect(saved.id).toBeDefined();
    expect(saved.modelVersion).toBe('v1.0.0');
    expect(saved.inputPayload).toEqual({ area: 62, bedrooms: 2, cep: '04037-050' });
    expect(saved.featuresUsed).toEqual({ used: ['area', 'bedrooms', 'neighborhood_median'] });
  });
});
