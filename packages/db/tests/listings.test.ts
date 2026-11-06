import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, type TestDb } from './setup.js';
import { listingRepo } from '../src/repositories/listings.js';
import type { NewListing } from '../src/schema.js';

function sampleListing(overrides: Partial<NewListing> = {}): NewListing {
  return {
    source: 'zap',
    sourceListingId: 'zap-1',
    url: 'https://www.zapimoveis.com.br/imovel/1',
    title: 'Apto 62m² Moema',
    description: 'Lindo apartamento',
    price: '500000.00',
    operation: 'sale',
    scrapedAt: new Date('2026-04-15T12:00:00Z'),
    ...overrides,
  };
}

describe('listingRepo.upsertBatch', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.dispose();
  });

  it('é idempotente em (source, source_listing_id): mesmo array 2x → sem duplicatas', async () => {
    const batch = [sampleListing(), sampleListing({ sourceListingId: 'zap-2' })];

    await listingRepo.upsertBatch(t.db, batch);
    await listingRepo.upsertBatch(t.db, batch);

    const all = await t.raw.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM listings',
    );
    expect(all.rows[0]?.count).toBe('2');
  });

  it('atualiza preço quando mesmo (source, source_listing_id) reaparece com preço diferente', async () => {
    await listingRepo.upsertBatch(t.db, [sampleListing({ price: '500000.00' })]);
    await listingRepo.upsertBatch(t.db, [sampleListing({ price: '550000.00' })]);

    const found = await listingRepo.findBySourceId(t.db, 'zap', 'zap-1');
    expect(found).not.toBeNull();
    expect(Number(found!.price)).toBe(550_000);

    const all = await t.raw.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM listings',
    );
    expect(all.rows[0]?.count).toBe('1');
  });

  it('preserves dated prices and replay does not duplicate observations', async () => {
    const first = sampleListing({ price: '500000.00' });
    const second = sampleListing({
      price: '550000.00',
      scrapedAt: new Date('2026-04-16T12:00:00Z'),
    });
    await listingRepo.upsertBatch(t.db, [first]);
    await listingRepo.upsertBatch(t.db, [second]);
    await listingRepo.upsertBatch(t.db, [second]);
    const snapshots = await t.raw.query<{ price: string; captured_at: Date }>(
      'SELECT price, captured_at FROM listing_snapshots ORDER BY captured_at',
    );
    expect(snapshots.rows.map((row) => Number(row.price))).toEqual([500000, 550000]);
    expect(snapshots.rows.map((row) => new Date(row.captured_at).toISOString())).toEqual([
      '2026-04-15T12:00:00.000Z',
      '2026-04-16T12:00:00.000Z',
    ]);
  });

  it('same listing id from different portals remains independent', async () => {
    await listingRepo.upsertBatch(t.db, [
      sampleListing(),
      sampleListing({ source: 'vivareal', price: '600000.00' }),
    ]);
    expect(Number((await listingRepo.findBySourceId(t.db, 'zap', 'zap-1'))?.price)).toBe(500000);
    expect(Number((await listingRepo.findBySourceId(t.db, 'vivareal', 'zap-1'))?.price)).toBe(
      600000,
    );
  });

  it('rolls back listing changes when the observation cannot be written', async () => {
    await listingRepo.upsertBatch(t.db, [sampleListing()]);
    await t.raw.exec(`CREATE FUNCTION reject_snapshot() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'snapshot unavailable'; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_snapshot BEFORE INSERT ON listing_snapshots
      FOR EACH ROW EXECUTE FUNCTION reject_snapshot();`);
    await expect(
      listingRepo.upsertBatch(t.db, [
        sampleListing({
          price: '550000.00',
          scrapedAt: new Date('2026-04-16T12:00:00Z'),
        }),
      ]),
    ).rejects.toMatchObject({ cause: { message: 'snapshot unavailable' } });
    const listing = await listingRepo.findBySourceId(t.db, 'zap', 'zap-1');
    expect(Number(listing?.price)).toBe(500000);
    expect(listing?.scrapedAt.toISOString()).toBe('2026-04-15T12:00:00.000Z');
    expect((await t.raw.query('SELECT * FROM listing_snapshots')).rows).toHaveLength(1);
  });

  it('preserves historical operation and property when the same source listing changes', async () => {
    const properties = await t.raw.query<{ id: string }>(
      `INSERT INTO properties(fingerprint,area_m2) VALUES ('old-property',100),('new-property',200) RETURNING id`,
    );
    const oldId = properties.rows[0]!.id;
    const newId = properties.rows[1]!.id;
    await listingRepo.upsertBatch(t.db, [
      sampleListing({ propertyId: oldId, operation: 'rent', price: '3500.00' }),
    ]);
    await listingRepo.upsertBatch(t.db, [
      sampleListing({
        propertyId: newId,
        operation: 'sale',
        price: '550000.00',
        scrapedAt: new Date('2026-04-16T12:00:00Z'),
      }),
    ]);
    const snapshots = await t.raw.query<{ property_id: string; operation: string; price: string }>(
      'SELECT property_id,operation,price FROM listing_snapshots ORDER BY captured_at',
    );
    expect(snapshots.rows.map((row) => ({ ...row, price: Number(row.price) }))).toEqual([
      { property_id: oldId, operation: 'rent', price: 3500 },
      { property_id: newId, operation: 'sale', price: 550000 },
    ]);
    expect((await listingRepo.findBySourceId(t.db, 'zap', 'zap-1'))?.propertyId).toBe(newId);
  });
});
