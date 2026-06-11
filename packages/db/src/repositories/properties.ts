/**
 * Repositório de properties (imóveis físicos, cross-portal).
 *
 * `upsertFromListing` usa o fingerprint do shared package:
 *   - fingerprint novo  → INSERT;
 *   - fingerprint conhecido → reuso + update de last_seen_at.
 */
import { and, eq, isNull, lt, or, max } from 'drizzle-orm';
import { computeFingerprint, type NormalizedListing } from '@imovi/shared';
import { properties, iptuRecords, type Property } from '../schema.js';
import type { AnyDbClient } from './types.js';

const IPTU_FRESHNESS_MS = 365 * 24 * 60 * 60 * 1000;

export interface ListWithoutFreshIptuOpts {
  limit?: number;
  /** Override de "agora" para testes determinísticos. Default: new Date(). */
  now?: Date;
}

export interface UpsertFromListingOpts {
  /** neighborhood_id resolvido pelo matcher (pipeline). Preenche apenas se ainda NULL. */
  neighborhoodId?: string;
}

export interface PropertyRepo {
  findByFingerprint(db: AnyDbClient, fingerprint: string): Promise<Property | null>;
  upsertFromListing(
    db: AnyDbClient,
    listing: NormalizedListing,
    opts?: UpsertFromListingOpts,
  ): Promise<Property>;
  /**
   * Retorna properties que NÃO possuem registro IPTU com `fetched_at` dentro
   * da janela de 365 dias. Usado pelo pipeline de enrichment para decidir
   * quais properties precisam de nova consulta.
   */
  listWithoutFreshIptu(
    db: AnyDbClient,
    opts?: ListWithoutFreshIptuOpts,
  ): Promise<Property[]>;
  /** Properties da cidade com neighborhood_id NULL (para backfill do matcher). */
  listWithoutNeighborhood(
    db: AnyDbClient,
    city: string,
    state: string,
  ): Promise<Array<{ id: string; addressRaw: string | null }>>;
  /** Seta neighborhood_id de uma property (backfill). */
  setNeighborhoodId(db: AnyDbClient, id: string, neighborhoodId: string): Promise<void>;
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

  async upsertFromListing(db, listing, opts) {
    const fingerprint = computeFingerprint(listing);
    const addr = listing.addressNormalized;
    const now = new Date();

    const existing = await propertyRepo.findByFingerprint(db, fingerprint);
    if (existing) {
      const [updated] = await db
        .update(properties)
        .set({
          lastSeenAt: now,
          // Preenche neighborhood_id apenas se ainda não setado (não sobrescreve).
          ...(opts?.neighborhoodId && !existing.neighborhoodId
            ? { neighborhoodId: opts.neighborhoodId }
            : {}),
        })
        .where(eq(properties.id, existing.id))
        .returning();
      return updated ?? existing;
    }

    const [inserted] = await db
      .insert(properties)
      .values({
        fingerprint,
        neighborhoodId: opts?.neighborhoodId ?? null,
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

  async listWithoutNeighborhood(db, city, state) {
    return await db
      .select({ id: properties.id, addressRaw: properties.addressRaw })
      .from(properties)
      .where(
        and(
          isNull(properties.neighborhoodId),
          eq(properties.city, city),
          eq(properties.state, state),
        ),
      );
  },

  async setNeighborhoodId(db, id, neighborhoodId) {
    await db.update(properties).set({ neighborhoodId }).where(eq(properties.id, id));
  },

  async listWithoutFreshIptu(db, opts = {}) {
    const now = opts.now ?? new Date();
    const cutoff = new Date(now.getTime() - IPTU_FRESHNESS_MS);
    const limit = opts.limit ?? 100;

    // Subquery: MAX(fetched_at) por property.
    const latest = db
      .select({
        propertyId: iptuRecords.propertyId,
        lastFetched: max(iptuRecords.fetchedAt).as('last_fetched'),
      })
      .from(iptuRecords)
      .groupBy(iptuRecords.propertyId)
      .as('latest');

    const rows = await db
      .select()
      .from(properties)
      .leftJoin(latest, eq(latest.propertyId, properties.id))
      .where(or(isNull(latest.lastFetched), lt(latest.lastFetched, cutoff)))
      .orderBy(properties.firstSeenAt)
      .limit(limit);

    // leftJoin retorna { properties, latest }. Mapear pra Property[].
    return rows.map((r) => (r as unknown as { properties: Property }).properties);
  },
};
