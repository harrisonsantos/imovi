import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, type TestDb } from './setup.js';
import { propertyRepo } from '../src/repositories/properties.js';
import { iptuRepo } from '../src/repositories/iptu.js';
import { makeNormalizedListing } from './fixtures.js';

describe('iptuRepo.getFresh', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.dispose();
  });

  it('retorna registro quando fetched_at < 365 dias; null quando estagnado', async () => {
    const property = await propertyRepo.upsertFromListing(t.db, makeNormalizedListing());

    // Registro fresco (30 dias atrás).
    const now = new Date('2026-04-15T00:00:00Z');
    const fresh = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    await t.raw.query(
      `INSERT INTO iptu_records (property_id, source, tax_year, iptu_amount, fetched_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [property.id, 'prefeitura-sp', 2025, 1200.0, fresh.toISOString()],
    );

    const got = await iptuRepo.getFresh(t.db, property.id, now);
    expect(got).not.toBeNull();
    expect(got!.propertyId).toBe(property.id);
    expect(got!.source).toBe('prefeitura-sp');

    // Registro velho (400 dias) para outro property → deve retornar null.
    const other = await propertyRepo.upsertFromListing(
      t.db,
      makeNormalizedListing({
        addressNormalized: {
          street: 'Rua X',
          number: '1',
          neighborhood: 'Y',
          city: 'São Paulo',
          state: 'SP',
          cep: '01000-000',
        },
      }),
    );
    const stale = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);
    await t.raw.query(
      `INSERT INTO iptu_records (property_id, source, tax_year, iptu_amount, fetched_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [other.id, 'prefeitura-sp', 2024, 1000.0, stale.toISOString()],
    );
    const staleGot = await iptuRepo.getFresh(t.db, other.id, now);
    expect(staleGot).toBeNull();
  });
});
