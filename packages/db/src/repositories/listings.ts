/**
 * Repositório de listings (anúncios brutos por portal).
 *
 * Contratos:
 *   - `upsertBatch` é idempotente em (source, source_listing_id): inserir o
 *     mesmo array duas vezes NÃO duplica linhas.
 *   - Se aparecer o mesmo (source, source_listing_id) com preço diferente,
 *     o registro é atualizado (price, scraped_at, title, description, url).
 */
import { eq, and, desc } from 'drizzle-orm';
import { listings, type Listing, type NewListing } from '../schema.js';
import type { AnyDbClient } from './types.js';

export interface ListingRepo {
  upsertBatch(db: AnyDbClient, rows: NewListing[]): Promise<Listing[]>;
  findBySourceId(
    db: AnyDbClient,
    source: string,
    sourceListingId: string,
  ): Promise<Listing | null>;
  listByProperty(db: AnyDbClient, propertyId: string): Promise<Listing[]>;
}

export const listingRepo: ListingRepo = {
  async upsertBatch(db, rows) {
    if (rows.length === 0) return [];
    const out: Listing[] = [];
    // Upsert linha-a-linha para que cada registro aplique seus próprios
    // valores no SET de conflito (um insert-statement só aceita um SET
    // estático, então lotes com valores distintos por linha exigem loop).
    for (const row of rows) {
      const r = await db
        .insert(listings)
        .values(row)
        .onConflictDoUpdate({
          target: [listings.source, listings.sourceListingId],
          set: {
            price: row.price as typeof listings.$inferInsert.price,
            title: row.title,
            description: row.description,
            url: row.url,
            scrapedAt: row.scrapedAt,
            propertyId: row.propertyId,
            delistedAt: row.delistedAt ?? null,
          },
        })
        .returning();
      if (r[0]) out.push(r[0]);
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
