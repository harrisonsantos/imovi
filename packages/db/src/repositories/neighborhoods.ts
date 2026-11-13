/**
 * Repositório de neighborhoods (bairros com mediana de preço/m²).
 *
 * `listByCity` alimenta o neighborhood matcher do pipeline de scraping
 * (resolve bairro extraído do addressRaw → neighborhood_id).
 */
import { and, eq, sql } from 'drizzle-orm';
import { neighborhoods } from '../schema.js';
import type { AnyDbClient } from './types.js';

export interface NeighborhoodSummary {
  id: string;
  name: string;
}

export interface NeighborhoodRepo {
  listByCity(db: AnyDbClient, city: string, state: string): Promise<NeighborhoodSummary[]>;
  aggregate(
    db: AnyDbClient,
    opts?: { now?: Date; minProperties?: number; days?: number },
  ): Promise<{ updated: number; observed: number; insufficient: number }>;
}

export const neighborhoodRepo: NeighborhoodRepo = {
  async aggregate(db, opts = {}) {
    const now = opts.now ?? new Date();
    const minProperties = opts.minProperties ?? 20;
    const days = opts.days ?? 90;
    if (
      !Number.isInteger(minProperties) ||
      minProperties < 20 ||
      !Number.isFinite(days) ||
      days <= 0
    ) {
      throw new Error(
        'Aggregation requires at least 20 properties and a positive freshness window',
      );
    }
    const cutoff = new Date(now.getTime() - days * 86400000);
    const result = await db.execute(sql`
      WITH latest AS (
        SELECT DISTINCT ON (p.id) p.id, p.neighborhood_id, s.price, p.area_m2
        FROM properties p
        JOIN listing_snapshots s ON s.property_id = p.id
        JOIN listings l ON l.id = s.listing_id AND l.property_id = s.property_id
        WHERE p.neighborhood_id IS NOT NULL
          AND s.operation = 'sale' AND l.operation = 'sale' AND l.delisted_at IS NULL
          AND s.captured_at >= ${cutoff.toISOString()}::timestamptz
          AND s.captured_at <= ${now.toISOString()}::timestamptz
        ORDER BY p.id, s.captured_at DESC, l.id
      ), stats AS (
        SELECT neighborhood_id, count(*)::integer AS sample_count,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY price / area_m2) AS median
        FROM latest WHERE price > 0 AND area_m2 > 0 GROUP BY neighborhood_id
      ), values_for_update AS (
        SELECT n.id, coalesce(s.sample_count, 0) AS sample_count, s.median
        FROM neighborhoods n LEFT JOIN stats s ON s.neighborhood_id = n.id
      )
      UPDATE neighborhoods n SET
        listing_count = v.sample_count,
        median_price_m2 = CASE WHEN v.sample_count >= ${minProperties} THEN v.median
          WHEN n.price_source = 'seed_reference' THEN n.median_price_m2 ELSE NULL END,
        price_source = CASE WHEN v.sample_count >= ${minProperties} THEN 'observed_listings'
          WHEN n.price_source = 'seed_reference' AND n.median_price_m2 IS NOT NULL
            THEN 'seed_reference' ELSE 'insufficient_data' END,
        last_aggregated_at = ${now.toISOString()}::timestamptz
      FROM values_for_update v WHERE n.id = v.id
      RETURNING n.price_source
    `);
    const returned = Array.isArray(result)
      ? result
      : result !== null && typeof result === 'object' && 'rows' in result
        ? result.rows
        : null;
    if (!Array.isArray(returned))
      throw new Error('Aggregation returned an unsupported database response');
    const sources = returned.map((row: unknown) => {
      if (
        row !== null &&
        typeof row === 'object' &&
        'price_source' in row &&
        typeof row.price_source === 'string'
      ) {
        return row.price_source;
      }
      throw new Error('Aggregation returned an invalid neighborhood row');
    });
    return {
      updated: sources.length,
      observed: sources.filter((source) => source === 'observed_listings').length,
      insufficient: sources.filter((source) => source === 'insufficient_data').length,
    };
  },
  async listByCity(db, city, state) {
    return await db
      .select({ id: neighborhoods.id, name: neighborhoods.name })
      .from(neighborhoods)
      .where(and(eq(neighborhoods.city, city), eq(neighborhoods.state, state)));
  },
};
