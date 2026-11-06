/**
 * Repositório de listings (anúncios brutos por portal).
 *
 * Contratos:
 *   - `upsertBatch` é idempotente em (source, source_listing_id): inserir o
 *     mesmo array duas vezes NÃO duplica linhas.
 *   - Se aparecer o mesmo (source, source_listing_id) com preço diferente,
 *     o registro é atualizado (price, scraped_at, title, description, url).
 */
import { eq, and, desc, sql } from 'drizzle-orm';
import { listings, type Listing, type NewListing } from '../schema.js';
import type { AnyDbClient } from './types.js';

export interface ListingRepo {
  upsertBatch(db: AnyDbClient, rows: NewListing[]): Promise<Listing[]>;
  findBySourceId(db: AnyDbClient, source: string, sourceListingId: string): Promise<Listing | null>;
  listByProperty(db: AnyDbClient, propertyId: string): Promise<Listing[]>;
}

export const listingRepo: ListingRepo = {
  async upsertBatch(db, rows) {
    if (rows.length === 0) return [];
    const out: Listing[] = [];
    for (const row of rows) {
      // A single statement preserves the dated observation even if the process dies.
      // Snapshot failure rolls back the current listing change on neon-http too.
      const result = await db.execute(sql`
        WITH upserted AS (
          INSERT INTO listings (id, property_id, source, source_listing_id, url, title,
            description, price, operation, raw_html_ref, scraped_at, delisted_at)
          VALUES (${row.id ?? crypto.randomUUID()}::uuid, ${row.propertyId ?? null}::uuid,
            ${row.source}, ${row.sourceListingId}, ${row.url ?? null}, ${row.title ?? null},
            ${row.description ?? null}, ${row.price ?? null}::numeric, ${row.operation ?? null},
            ${row.rawHtmlRef ?? null}, ${row.scrapedAt.toISOString()}::timestamptz,
            ${row.delistedAt?.toISOString() ?? null}::timestamptz)
          ON CONFLICT (source, source_listing_id) DO UPDATE SET
            price = CASE WHEN ${row.price !== undefined}::boolean THEN excluded.price ELSE listings.price END,
            operation = CASE WHEN ${row.operation !== undefined}::boolean THEN excluded.operation ELSE listings.operation END,
            title = CASE WHEN ${row.title !== undefined}::boolean THEN excluded.title ELSE listings.title END,
            description = CASE WHEN ${row.description !== undefined}::boolean THEN excluded.description ELSE listings.description END,
            url = CASE WHEN ${row.url !== undefined}::boolean THEN excluded.url ELSE listings.url END,
            scraped_at = excluded.scraped_at,
            property_id = CASE WHEN ${row.propertyId !== undefined}::boolean THEN excluded.property_id ELSE listings.property_id END,
            delisted_at = excluded.delisted_at
          RETURNING *
        ), captured AS (
          INSERT INTO listing_snapshots (listing_id, price, captured_at, property_id, operation)
          SELECT id, ${row.price ?? null}::numeric, scraped_at,
            ${row.propertyId ?? null}::uuid, ${row.operation ?? null}::text FROM upserted
          ON CONFLICT (listing_id, captured_at) DO NOTHING RETURNING listing_id
        )
        SELECT id, property_id AS "propertyId", source, source_listing_id AS "sourceListingId",
          url, title, description, price, operation, raw_html_ref AS "rawHtmlRef",
          scraped_at AS "scrapedAt", delisted_at AS "delistedAt"
        FROM upserted CROSS JOIN (SELECT count(*) FROM captured) capture_completed
      `);
      const returned = Array.isArray(result)
        ? result
        : result !== null && typeof result === 'object' && 'rows' in result
          ? result.rows
          : null;
      if (!Array.isArray(returned))
        throw new Error('Listing upsert returned an unsupported database response');
      for (const value of returned) {
        const stored = value as Listing;
        out.push({
          ...stored,
          scrapedAt: new Date(stored.scrapedAt),
          delistedAt: stored.delistedAt === null ? null : new Date(stored.delistedAt),
        });
      }
    }
    return out;
  },

  async findBySourceId(db, source, sourceListingId) {
    const rows = await db
      .select()
      .from(listings)
      .where(and(eq(listings.source, source), eq(listings.sourceListingId, sourceListingId)))
      .limit(1);
    return rows[0] ?? null;
  },

  async listByProperty(db, propertyId) {
    return await db
      .select()
      .from(listings)
      .where(eq(listings.propertyId, propertyId))
      .orderBy(desc(listings.scrapedAt));
  },
};
