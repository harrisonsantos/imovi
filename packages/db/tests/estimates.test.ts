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
    expect(await estimateRepo.findById(t.db, saved.id)).toMatchObject({
      id: saved.id,
      estimate: '500000.00',
      inputPayload: saved.inputPayload,
    });
  });

  it('retains historical price source metadata without querying mutable neighborhood state', async () => {
    const metadata = {
      method: 'heuristic',
      neighborhood: { name: 'Batel', medianPriceM2: 10000 },
      dataSource: { kind: 'seed_reference', sampleCount: 0, updatedAt: null },
      generatedAt: '2026-09-30T12:00:00.000Z',
    };
    const saved = await estimateRepo.record(t.db, {
      inputPayload: { area: 62 },
      estimate: '620000.00',
      modelVersion: 'heuristic-v0',
      resultMetadata: metadata,
    });
    expect((await estimateRepo.findById(t.db, saved.id))?.resultMetadata).toEqual(metadata);
    expect(await estimateRepo.findById(t.db, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBeNull();
  });
});
