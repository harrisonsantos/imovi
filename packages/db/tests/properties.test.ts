import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, type TestDb } from './setup.js';
import { propertyRepo } from '../src/repositories/properties.js';
import { makeNormalizedListing } from './fixtures.js';

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
