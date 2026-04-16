/**
 * Repositório de properties (imóveis físicos, cross-portal).
 *
 * `upsertFromListing` usa o fingerprint do shared package:
 *   - fingerprint novo  → INSERT;
 *   - fingerprint conhecido → reuso + update de last_seen_at.
 */
import { eq } from 'drizzle-orm';
import { computeFingerprint, type NormalizedListing } from '@imovi/shared';
import { properties, type Property } from '../schema.js';
import type { AnyDbClient } from './types.js';

export interface PropertyRepo {
  findByFingerprint(db: AnyDbClient, fingerprint: string): Promise<Property | null>;
  upsertFromListing(db: AnyDbClient, listing: NormalizedListing): Promise<Property>;
}

export const propertyRepo: PropertyRepo = {
  async findByFingerprint(db, fingerprint) {
    const rows = await db
      .select()
      .from(properties)
      .where(eq(properties.fingerprint, fingerprint))
      .limit(1);
    return rows[0] ?? null;
  },

  async upsertFromListing(db, listing) {
    const fingerprint = computeFingerprint(listing);
    const addr = listing.addressNormalized;
    const now = new Date();

    const existing = await propertyRepo.findByFingerprint(db, fingerprint);
    if (existing) {
      const [updated] = await db
        .update(properties)
        .set({ lastSeenAt: now })
        .where(eq(properties.id, existing.id))
        .returning();
      return updated ?? existing;
    }

    const [inserted] = await db
      .insert(properties)
      .values({
        fingerprint,
        addressRaw: listing.addressRaw,
        street: addr.street,
        number: addr.number,
        city: addr.city,
        state: addr.state,
        cep: addr.cep,
        propertyType: listing.propertyType,
        areaM2: listing.area.toFixed(2),
        bedrooms: listing.bedrooms ?? null,
        bathrooms: listing.bathrooms ?? null,
        parking: listing.parking ?? null,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .returning();
    if (!inserted) throw new Error('propertyRepo.upsertFromListing: insert returned no row');
    return inserted;
  },
};
