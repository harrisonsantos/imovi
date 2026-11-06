import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createTestDb } from './setup.js';

describe('stabilization migration on legacy data', () => {
  it('preserves processed events and only backfills associations with evidence', async () => {
    const t = await createTestDb({ through: 6 });
    try {
      const property = '00000000-0000-4000-8000-000000000001';
      const listing = '00000000-0000-4000-8000-000000000002';
      await t.raw.query(
        `INSERT INTO properties (id, fingerprint) VALUES ($1, 'migration-property')`,
        [property],
      );
      await t.raw.query(
        `INSERT INTO listings (id, property_id, source, source_listing_id, price, operation, scraped_at)
        VALUES ($1, $2, 'fixture', 'migration-listing', 400000, 'sale', '2026-09-20T00:00:00Z')`,
        [listing, property],
      );
      await t.raw.query(
        `INSERT INTO listing_snapshots (listing_id, price, captured_at)
        VALUES ($1, 2000, '2026-08-20T00:00:00Z'), ($1, 400000, '2026-09-20T00:00:00Z')`,
        [listing],
      );
      await t.raw.exec(
        `INSERT INTO billing_events (id, type) VALUES ('legacy-event', 'invoice.paid')`,
      );
      const migration = await readFile(
        new URL('../migrations/0007_stabilization_pglite.sql', import.meta.url),
        'utf8',
      );
      await t.raw.exec(migration);
      await t.raw.exec(
        `INSERT INTO billing_events (id, type) VALUES ('new-event', 'invoice.paid')`,
      );
      await t.raw.exec(migration);
      const events = await t.raw.query<{ id: string; status: string; processed_at: unknown }>(
        'SELECT id, status, processed_at FROM billing_events ORDER BY id',
      );
      expect(events.rows[0]).toMatchObject({ id: 'legacy-event', status: 'processed' });
      expect(events.rows[0]?.processed_at).not.toBeNull();
      expect(events.rows[1]).toMatchObject({
        id: 'new-event',
        status: 'pending',
        processed_at: null,
      });
      const snapshots = await t.raw.query<{ property_id: string | null; operation: string | null }>(
        'SELECT property_id, operation FROM listing_snapshots ORDER BY captured_at',
      );
      expect(snapshots.rows).toEqual([
        { property_id: null, operation: null },
        { property_id: property, operation: 'sale' },
      ]);
    } finally {
      await t.dispose();
    }
  });
});
