import type { NormalizedListing, RawListing, ListingSource } from '@imovi/shared';
import type { Logger } from '../logger.js';

/**
 * Tipos estruturais locais — evitamos acoplamento a exports concretos dos
 * pacotes internos em tempo de compilação (permite fakes nos tests).
 */
export type DbClient = unknown;

export interface ListingRepo {
  upsertBatch(
    db: DbClient,
    listings: NormalizedListing[],
    propertyIds?: Map<string, string>,
  ): Promise<number>;
}

export interface PropertyRepo {
  upsertFromListing(db: DbClient, listing: NormalizedListing): Promise<{ id: string }>;
}

export interface ScrapeErrorRepo {
  record(db: DbClient, err: { source: ListingSource; message: string; at: Date }): Promise<void>;
}

export type ScraperFn = (ctx: { logger: Logger }) => AsyncGenerator<RawListing, void, void>;

export interface RunScrapeDeps {
  sources: ListingSource[];
  scrapers: Record<string, ScraperFn>;
  normalize: (raw: RawListing) => NormalizedListing | null;
  dedupe: (arr: NormalizedListing[]) =>
    | NormalizedListing[]
    | {
        clusters: Array<{ representative: NormalizedListing; listings: NormalizedListing[] }>;
      };
  db: DbClient;
  repos: {
    listings: ListingRepo;
    properties: PropertyRepo;
    errors: ScrapeErrorRepo;
  };
  logger: Logger;
  maxPerSource?: number;
}

/** Source IDs are only unique inside a portal. */
export function listingKey(listing: Pick<NormalizedListing, 'source' | 'sourceListingId'>): string {
  return JSON.stringify([listing.source, listing.sourceListingId]);
}

export interface RunScrapeResult {
  scraped: number;
  normalized: number;
  rejected: number;
  deduped: number;
  persisted: number;
  errors: number;
}

/**
 * Orquestra o pipeline de scraping:
 *   sources → scrapers → normalize → dedupe → persist
 *
 * Erros em um source não derrubam o pipeline — são registrados via
 * `repos.errors.record` e os demais sources seguem processando.
 */
export async function runScrape(deps: RunScrapeDeps): Promise<RunScrapeResult> {
  const { sources, scrapers, normalize, dedupe, db, repos, logger, maxPerSource } = deps;

  const result: RunScrapeResult = {
    scraped: 0,
    normalized: 0,
    rejected: 0,
    deduped: 0,
    persisted: 0,
    errors: 0,
  };

  const normalizedAcc: NormalizedListing[] = [];

  for (const source of sources) {
    const scraper = scrapers[source];
    if (!scraper) {
      logger.warn('scraper_missing', { source });
      result.errors += 1;
      await repos.errors.record(db, { source, message: 'scraper_missing', at: new Date() });
      continue;
    }

    let countThisSource = 0;

    try {
      logger.info('scrape_source_start', { source });
      const gen = scraper({ logger });
      for await (const raw of gen) {
        result.scraped += 1;
        countThisSource += 1;

        try {
          const norm = normalize(raw);
          if (norm !== null) {
            result.normalized += 1;
            normalizedAcc.push(norm);
          } else {
            result.rejected += 1;
          }
        } catch {
          result.rejected += 1;
        }

        if (maxPerSource !== undefined && countThisSource >= maxPerSource) {
          logger.info('scrape_source_max_reached', { source, max: maxPerSource });
          break;
        }
      }
      if (countThisSource === 0) throw new Error('scraper_empty_result');
      logger.info('scrape_source_done', { source, count: countThisSource });
    } catch (err) {
      result.errors += 1;
      const message = err instanceof Error ? err.message : String(err);
      logger.error('scrape_source_failed', { source, error: message });
      try {
        await repos.errors.record(db, {
          source,
          message,
          at: new Date(),
        });
      } catch (recordErr) {
        // Falha ao registrar erro não derruba o pipeline — apenas loga.
        logger.error('scrape_error_record_failed', {
          source,
          error: recordErr instanceof Error ? recordErr.message : String(recordErr),
        });
      }
    }
  }

  // Dedupe global (union-find ±1m² — impl em @imovi/normalizer).
  const deduped = dedupe(normalizedAcc);
  const clusters = Array.isArray(deduped)
    ? deduped.map((listing) => ({ representative: listing, listings: [listing] }))
    : deduped.clusters;
  result.deduped = clusters.length;

  // Persistência: upserta properties primeiro para obter IDs, depois
  // upserta listings com o propertyId correto (necessário para ML training).
  if (clusters.length > 0) {
    const propertyIds = new Map<string, string>();
    const rowsToPersist: NormalizedListing[] = [];
    for (const cluster of clusters) {
      const listing = cluster.representative;
      try {
        const prop = await repos.properties.upsertFromListing(db, listing);
        for (const sourceListing of cluster.listings) {
          propertyIds.set(listingKey(sourceListing), prop.id);
          rowsToPersist.push(sourceListing);
        }
      } catch (err) {
        result.errors += 1;
        logger.error('property_upsert_failed', {
          sourceListingId: listing.sourceListingId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    for (const listing of rowsToPersist) {
      try {
        result.persisted += await repos.listings.upsertBatch(db, [listing], propertyIds);
      } catch (err) {
        result.errors += 1;
        logger.error('listing_batch_failed', {
          source: listing.source,
          sourceListingId: listing.sourceListingId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  logger.info('scrape_pipeline_done', { ...result });
  return result;
}
