import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, type TestDb } from './setup.js';
import { propertyRepo } from '../src/repositories/properties.js';
import { makeNormalizedListing } from './fixtures.js';

function makeListingAt(street: string, number: string, cep: string) {
  return makeNormalizedListing({
    addressNormalized: {
      street,
      number,
      neighborhood: 'Centro',
      city: 'Curitiba',
      state: 'PR',
      cep,
    },
  });
}

describe('propertyRepo', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.dispose();
  });

  it('findByFingerprint retorna null quando fingerprint não existe', async () => {
    const r = await propertyRepo.findByFingerprint(t.db, 'nao-existe');
    expect(r).toBeNull();
  });

  it('upsertFromListing cria property se fingerprint novo, reusa se já existir', async () => {
    const listing = makeNormalizedListing();

    const first = await propertyRepo.upsertFromListing(t.db, listing);
    expect(first.id).toBeDefined();
    expect(first.fingerprint).toBeDefined();

    const second = await propertyRepo.upsertFromListing(t.db, listing);
    expect(second.id).toBe(first.id);

    const countRes = await t.raw.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM properties',
    );
    expect(countRes.rows[0]?.count).toBe('1');

    // Listing diferente (outro CEP) → novo property.
    const other = makeNormalizedListing({
      addressNormalized: {
        street: 'Rua Outra',
        number: '99',
        neighborhood: 'Pinheiros',
        city: 'São Paulo',
        state: 'SP',
        cep: '05422-000',
      },
    });
    const third = await propertyRepo.upsertFromListing(t.db, other);
    expect(third.id).not.toBe(first.id);
  });
});

describe('propertyRepo.listWithoutFreshIptu', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.dispose();
  });

  it('retorna properties sem iptu record, exclui as com registro fresco, inclui stale, respeita limit', async () => {
    const now = new Date('2026-04-15T00:00:00Z');

    const noIptu = await propertyRepo.upsertFromListing(
      t.db,
      makeListingAt('Rua A', '1', '80000-001'),
    );
    const freshIptu = await propertyRepo.upsertFromListing(
      t.db,
      makeListingAt('Rua B', '2', '80000-002'),
    );
    const staleIptu = await propertyRepo.upsertFromListing(
      t.db,
      makeListingAt('Rua C', '3', '80000-003'),
    );

    const fresh = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const stale = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);
    await t.raw.query(
      `INSERT INTO iptu_records (property_id, source, tax_year, iptu_amount, fetched_at)
       VALUES ($1, 'manual', 2025, 1000, $2)`,
      [freshIptu.id, fresh.toISOString()],
    );
    await t.raw.query(
      `INSERT INTO iptu_records (property_id, source, tax_year, iptu_amount, fetched_at)
       VALUES ($1, 'manual', 2024, 900, $2)`,
      [staleIptu.id, stale.toISOString()],
    );

    const rows = await propertyRepo.listWithoutFreshIptu(t.db, { now });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(noIptu.id);
    expect(ids).toContain(staleIptu.id);
    expect(ids).not.toContain(freshIptu.id);

    const limited = await propertyRepo.listWithoutFreshIptu(t.db, { now, limit: 1 });
    expect(limited).toHaveLength(1);
  });
});
