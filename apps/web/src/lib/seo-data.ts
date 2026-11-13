import { cache } from 'react';
import { and, asc, eq } from '@imovi/db/operators';
import { cities, neighborhoods } from '@imovi/db/schema';
import { getCfEnv } from './cf-env';
import { getDb } from './db';
import { seoSlug } from './seo';

export const MIN_LISTINGS_FOR_INDEX = 20;

export function isIndexablePriceReference(source: string, propertyCount: number): boolean {
  return source === 'observed_listings' && propertyCount >= MIN_LISTINGS_FOR_INDEX;
}

export interface SeoNeighborhood {
  name: string;
  slug: string;
  medianPriceM2: number;
  listingCount: number;
  lastAggregatedAt: Date | null;
  indexable: boolean;
}

export interface SeoCity {
  name: string;
  state: string;
  slug: string;
  neighborhoods: SeoNeighborhood[];
  indexableNeighborhoods: SeoNeighborhood[];
  medianPriceM2: number | null;
  lastAggregatedAt: Date | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

export const getSeoCity = cache(async (citySlug: string): Promise<SeoCity | null> => {
  const cfEnv = await getCfEnv();
  const db = getDb(cfEnv.DATABASE_URL);
  const [city] = await db
    .select({ name: cities.name, state: cities.state, slug: cities.slug })
    .from(cities)
    .where(and(eq(cities.slug, citySlug), eq(cities.active, true)))
    .limit(1);
  if (!city) return null;

  const rows = await db
    .select({
      name: neighborhoods.name,
      medianPriceM2: neighborhoods.medianPriceM2,
      listingCount: neighborhoods.listingCount,
      priceSource: neighborhoods.priceSource,
      lastAggregatedAt: neighborhoods.lastAggregatedAt,
    })
    .from(neighborhoods)
    .where(and(eq(neighborhoods.city, city.name), eq(neighborhoods.state, city.state)))
    .orderBy(asc(neighborhoods.name));

  const mapped = rows
    .map((row): SeoNeighborhood | null => {
      const price = row.medianPriceM2 === null ? 0 : Number(row.medianPriceM2);
      const count = row.listingCount ?? 0;
      if (!Number.isFinite(price) || price <= 0) return null;
      return {
        name: row.name,
        slug: seoSlug(row.name),
        medianPriceM2: price,
        listingCount: count,
        lastAggregatedAt: row.lastAggregatedAt,
        indexable: isIndexablePriceReference(row.priceSource, count),
      };
    })
    .filter((row): row is SeoNeighborhood => row !== null);
  const indexableNeighborhoods = mapped.filter((row) => row.indexable);
  const dates = indexableNeighborhoods
    .map((row) => row.lastAggregatedAt)
    .filter((date): date is Date => date !== null);

  return {
    ...city,
    neighborhoods: mapped,
    indexableNeighborhoods,
    medianPriceM2: median(indexableNeighborhoods.map((row) => row.medianPriceM2)),
    lastAggregatedAt:
      dates.length > 0 ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null,
  };
});

export const getSeoCatalog = cache(async (): Promise<SeoCity[]> => {
  const cfEnv = await getCfEnv();
  const db = getDb(cfEnv.DATABASE_URL);
  const activeCities = await db
    .select({ slug: cities.slug })
    .from(cities)
    .where(eq(cities.active, true))
    .orderBy(asc(cities.name));
  const data = await Promise.all(activeCities.map((city) => getSeoCity(city.slug)));
  return data.filter((city): city is SeoCity => city !== null);
});

export async function getSeoNeighborhood(
  citySlug: string,
  neighborhoodSlug: string,
): Promise<{ city: SeoCity; neighborhood: SeoNeighborhood } | null> {
  const city = await getSeoCity(citySlug);
  if (!city) return null;
  const neighborhood = city.indexableNeighborhoods.find((item) => item.slug === neighborhoodSlug);
  return neighborhood ? { city, neighborhood } : null;
}
