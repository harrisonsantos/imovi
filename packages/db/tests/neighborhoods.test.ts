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

describe('neighborhoodRepo.aggregate', () => {
  let t: TestDb;
  const now = new Date('2026-09-30T12:00:00Z');
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.dispose();
  });

  async function seed(count: number): Promise<string> {
    const neighborhood = await t.raw.query<{ id: string }>(
      `INSERT INTO neighborhoods(city,state,name,median_price_m2)
       VALUES ('Curitiba','PR','Batel',1234) RETURNING id`,
    );
    const id = neighborhood.rows[0]!.id;
    await t.raw.query(
      `INSERT INTO properties(fingerprint,neighborhood_id,area_m2)
       SELECT 'property-' || n, $1, 100 FROM generate_series(1,$2::integer) n`,
      [id, count],
    );
    await t.raw.query(
      `INSERT INTO listings(property_id,source,source_listing_id,operation,price,scraped_at)
       SELECT id,'zap',fingerprint,'sale',200000 + substring(fingerprint from 10)::integer * 10000,
         '2026-09-29T12:00:00Z' FROM properties`,
    );
    await t.raw
      .query(`INSERT INTO listing_snapshots(listing_id,price,captured_at,property_id,operation)
      SELECT id,price,scraped_at,property_id,operation FROM listings`);
    return id;
  }

  it('uses latest sale observation once per property across portals', async () => {
    const id = await seed(20);
    await t.raw.query(`
      INSERT INTO listings(property_id,source,source_listing_id,operation,price,scraped_at)
      SELECT id,'vivareal','same-house','sale',1000000,'2026-09-30T10:00:00Z'
      FROM properties WHERE fingerprint = 'property-1'
    `);
    await t.raw
      .query(`INSERT INTO listing_snapshots(listing_id,price,captured_at,property_id,operation)
      SELECT id,price,scraped_at,property_id,operation FROM listings WHERE source='vivareal'`);
    expect(await neighborhoodRepo.aggregate(t.db, { now })).toEqual({
      updated: 1,
      observed: 1,
      insufficient: 0,
    });
    const result = await t.raw.query<{
      median_price_m2: string;
      listing_count: number;
      price_source: string;
    }>('SELECT median_price_m2, listing_count, price_source FROM neighborhoods WHERE id=$1', [id]);
    expect(result.rows[0]).toMatchObject({ listing_count: 20, price_source: 'observed_listings' });
    expect(Number(result.rows[0]!.median_price_m2)).toBe(3150);
  });

  it('keeps an explicit seed reference below twenty distinct properties', async () => {
    await seed(19);
    await neighborhoodRepo.aggregate(t.db, { now });
    const result = await t.raw.query<{
      median_price_m2: string;
      listing_count: number;
      price_source: string;
    }>('SELECT median_price_m2, listing_count, price_source FROM neighborhoods');
    expect(result.rows[0]).toMatchObject({ listing_count: 19, price_source: 'seed_reference' });
    expect(Number(result.rows[0]!.median_price_m2)).toBe(1234);
  });

  it('invalidates previously observed data when all observations become stale', async () => {
    await seed(20);
    await neighborhoodRepo.aggregate(t.db, { now });
    expect(await neighborhoodRepo.aggregate(t.db, { now: new Date('2027-02-01') })).toEqual({
      updated: 1,
      observed: 0,
      insufficient: 1,
    });
    const result = await t.raw.query(
      'SELECT median_price_m2, listing_count, price_source FROM neighborhoods',
    );
    expect(result.rows[0]).toEqual({
      median_price_m2: null,
      listing_count: 0,
      price_source: 'insufficient_data',
    });
  });

  it('excludes rental, delisted, zero price, invalid area and future observations', async () => {
    await seed(20);
    await t.raw.query(`UPDATE listings SET operation='rent' WHERE source_listing_id='property-1'`);
    await t.raw.query(
      `UPDATE listings SET delisted_at='2026-09-30' WHERE source_listing_id='property-2'`,
    );
    await t.raw.query(`UPDATE listing_snapshots SET price=0 WHERE listing_id IN
      (SELECT id FROM listings WHERE source_listing_id='property-3')`);
    await t.raw.query(`UPDATE properties SET area_m2=0 WHERE fingerprint='property-4'`);
    await t.raw.query(`UPDATE listing_snapshots SET captured_at='2026-10-01' WHERE listing_id IN
      (SELECT id FROM listings WHERE source_listing_id='property-5')`);
    await t.raw.query(`UPDATE listing_snapshots SET operation='rent' WHERE listing_id IN
      (SELECT id FROM listings WHERE source_listing_id='property-6')`);
    await t.raw.query(`UPDATE listing_snapshots SET property_id=NULL WHERE listing_id IN
      (SELECT id FROM listings WHERE source_listing_id='property-7')`);
    await t.raw
      .query(`UPDATE listings SET property_id=(SELECT id FROM properties WHERE fingerprint='property-1')
      WHERE source_listing_id='property-8'`);
    await neighborhoodRepo.aggregate(t.db, { now });
    const result = await t.raw.query('SELECT listing_count,price_source FROM neighborhoods');
    expect(result.rows[0]).toEqual({ listing_count: 12, price_source: 'seed_reference' });
  });
});
