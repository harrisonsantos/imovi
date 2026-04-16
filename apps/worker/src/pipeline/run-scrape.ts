import type { NormalizedListing, RawListing, ListingSource } from '@imovi/shared';
import type { Logger } from '../logger.js';

/**
 * Tipos estruturais locais — evitamos acoplamento a exports concretos dos
 * pacotes internos em tempo de compilação (permite fakes nos tests).
 */
export type DbClient = unknown;

export interface ListingRepo {
  upsertBatch(db: DbClient, listings: NormalizedListing[]): Promise<void>;
}

export interface PropertyRepo {
  upsertFromListing(db: DbClient, listing: NormalizedListing): Promise<void>;
}

export interface ScrapeErrorRepo {
  record(
    db: DbClient,
    err: { source: ListingSource; message: string; at: Date },
  ): Promise<void>;
}

export type ScraperFn = (ctx: {
  logger: Logger;
}) => AsyncGenerator<RawListing, void, void>;

export interface RunScrapeDeps {
  sources: ListingSource[];
  scrapers: Record<string, ScraperFn>;
  normalize: (raw: RawListing) => NormalizedListing | null;
  dedupe: (arr: NormalizedListing[]) => NormalizedListing[];
  db: DbClient;
  repos: {
    listings: ListingRepo;
    properties: PropertyRepo;
    errors: ScrapeErrorRepo;
  };
  logger: Logger;
  maxPerSource?: number;
}

export interface RunScrapeResult {
  scraped: number;
  normalized: number;
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
  const {
    sources,
    scrapers,
    normalize,
    dedupe,
    db,
    repos,
    logger,
    maxPerSource,
  } = deps;

  const result: RunScrapeResult = {
    scraped: 0,
    normalized: 0,
    deduped: 0,
    persisted: 0,
    errors: 0,
  };

  const normalizedAcc: NormalizedListing[] = [];

  for (const source of sources) {
    const scraper = scrapers[source];
    if (!scraper) {
      logger.warn('scraper_missing', { source });
      continue;
    }

    let countThisSource = 0;

    try {
      logger.info('scrape_source_start', { source });
      const gen = scraper({ logger });
      for await (const raw of gen) {
        result.scraped += 1;
        countThisSource += 1;

        const norm = normalize(raw);
        if (norm !== null) {
          result.normalized += 1;
          normalizedAcc.push(norm);
        }

        if (maxPerSource !== undefined && countThisSource >= maxPerSource) {
          logger.info('scrape_source_max_reached', { source, max: maxPerSource });
          break;
        }
      }
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
          error:
            recordErr instanceof Error ? recordErr.message : String(recordErr),
        });
      }
    }
  }

  // Dedupe global (union-find ±1m² — impl em @imovi/normalizer).
  const deduped = dedupe(normalizedAcc);
  result.deduped = deduped.length;

  // Persistência em batch; falhas individuais no property repo não param o batch.
  if (deduped.length > 0) {
    try {
      await repos.listings.upsertBatch(db, deduped);
      for (const listing of deduped) {
        try {
          await repos.properties.upsertFromListing(db, listing);
          result.persisted += 1;
        } catch (err) {
          result.errors += 1;
          logger.error('property_upsert_failed', {
            sourceListingId: listing.sourceListingId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      result.errors += 1;
      logger.error('listing_batch_failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('scrape_pipeline_done', { ...result });
  return result;
}
