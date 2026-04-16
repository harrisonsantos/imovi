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

    const all = await t.raw.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM listings');
    expect(all.rows[0]?.count).toBe('2');
  });

  it('atualiza preço quando mesmo (source, source_listing_id) reaparece com preço diferente', async () => {
    await listingRepo.upsertBatch(t.db, [sampleListing({ price: '500000.00' })]);
    await listingRepo.upsertBatch(t.db, [sampleListing({ price: '550000.00' })]);

    const found = await listingRepo.findBySourceId(t.db, 'zap', 'zap-1');
    expect(found).not.toBeNull();
    expect(Number(found!.price)).toBe(550_000);

    const all = await t.raw.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM listings');
    expect(all.rows[0]?.count).toBe('1');
  });
});
