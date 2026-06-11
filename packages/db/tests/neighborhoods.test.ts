import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, type TestDb } from './setup.js';
import { neighborhoodRepo } from '../src/repositories/neighborhoods.js';
import { propertyRepo } from '../src/repositories/properties.js';
import { makeNormalizedListing } from './fixtures.js';

describe('neighborhoodRepo.listByCity', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.dispose();
  });

  it('retorna bairros da cidade pedida, ignorando outras', async () => {
    await t.raw.query(
      `INSERT INTO neighborhoods (city, state, name) VALUES
       ('Curitiba', 'PR', 'Batel'),
       ('Curitiba', 'PR', 'Centro'),
       ('São Paulo', 'SP', 'Pinheiros')`,
    );

    const rows = await neighborhoodRepo.listByCity(t.db, 'Curitiba', 'PR');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.name).sort()).toEqual(['Batel', 'Centro']);
    expect(rows[0]?.id).toBeDefined();
  });

  it('retorna lista vazia para cidade sem bairros', async () => {
    const rows = await neighborhoodRepo.listByCity(t.db, 'Florianópolis', 'SC');
    expect(rows).toEqual([]);
  });
});

describe('propertyRepo.upsertFromListing com neighborhoodId', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.dispose();
  });

  async function seedNeighborhood(name: string): Promise<string> {
    const res = await t.raw.query<{ id: string }>(
      `INSERT INTO neighborhoods (city, state, name) VALUES ('Curitiba', 'PR', $1) RETURNING id`,
      [name],
    );
    return res.rows[0]!.id;
  }

  it('insere property com neighborhood_id quando fornecido', async () => {
    const nId = await seedNeighborhood('Batel');
    const prop = await propertyRepo.upsertFromListing(t.db, makeNormalizedListing(), {
      neighborhoodId: nId,
    });
    expect(prop.neighborhoodId).toBe(nId);
  });

  it('preenche neighborhood_id em property existente que estava NULL', async () => {
    const listing = makeNormalizedListing();
    const first = await propertyRepo.upsertFromListing(t.db, listing);
    expect(first.neighborhoodId).toBeNull();

    const nId = await seedNeighborhood('Centro');
    const second = await propertyRepo.upsertFromListing(t.db, listing, {
      neighborhoodId: nId,
    });
    expect(second.id).toBe(first.id);
    expect(second.neighborhoodId).toBe(nId);
  });

  it('não sobrescreve neighborhood_id existente com outro valor', async () => {
    const nA = await seedNeighborhood('Batel');
    const nB = await seedNeighborhood('Centro');
    const listing = makeNormalizedListing();

    const first = await propertyRepo.upsertFromListing(t.db, listing, { neighborhoodId: nA });
    const second = await propertyRepo.upsertFromListing(t.db, listing, { neighborhoodId: nB });
    expect(second.id).toBe(first.id);
    expect(second.neighborhoodId).toBe(nA);
  });

  it('sem opts → comportamento atual inalterado (neighborhood_id null)', async () => {
    const prop = await propertyRepo.upsertFromListing(t.db, makeNormalizedListing());
    expect(prop.neighborhoodId).toBeNull();
  });
});
