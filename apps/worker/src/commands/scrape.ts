import { normalize, dedupe } from '@imovi/normalizer';
import {
  createDbClient,
  listingRepo,
  propertyRepo,
  scrapeErrorRepo,
  type DbClient,
} from '@imovi/db';

import type { ListingSource, NormalizedListing, RawListing } from '@imovi/shared';
import type { Logger } from '../logger.js';
import {
  runScrape,
  type ScraperFn,
  type ListingRepo as PipelineListingRepo,
  type PropertyRepo as PipelinePropertyRepo,
  type ScrapeErrorRepo as PipelineScrapeErrorRepo,
} from '../pipeline/run-scrape.js';

export interface ScrapeCommandOpts {
  sources: ListingSource[];
  max?: number;
  databaseUrl: string;
  logger: Logger;
}

/** NormalizedListing → NewListing (Drizzle `numeric` espera string). */
function toDbListingRow(
  l: NormalizedListing,
): Parameters<typeof listingRepo.upsertBatch>[1][number] {
  return {
    source: l.source,
    sourceListingId: l.sourceListingId,
    url: l.url,
    title: l.title ?? null,
    description: l.description ?? null,
    price: l.price.toFixed(2),
    operation: l.operation,
    scrapedAt: l.scrapedAt,
  };
}

const listingRepoAdapter: PipelineListingRepo = {
  async upsertBatch(db, listings) {
    await listingRepo.upsertBatch(db as DbClient, listings.map(toDbListingRow));
  },
};

const propertyRepoAdapter: PipelinePropertyRepo = {
  async upsertFromListing(db, listing) {
    await propertyRepo.upsertFromListing(db as DbClient, listing);
  },
};

const scrapeErrorRepoAdapter: PipelineScrapeErrorRepo = {
  async record(db, err) {
    await scrapeErrorRepo.record(db as DbClient, {
      source: err.source,
      error: err.message,
      occurredAt: err.at,
    });
  },
};

/**
 * Wire real dos scrapers → pipeline.
 *
 * TODO(fase-5): `@imovi/scrapers` exige `{ fetcher, rateLimiter, proxyRotator,
 * location, operation }` por chamada. Vamos materializar esse wire quando
 * a config do scheduler (GH Actions cron) estiver definida — location/operation
 * virão do próprio job. Por ora o command loga que o wiring está pendente e
 * roda o pipeline com um map vazio para validar o caminho ponta-a-ponta.
 */
export async function runScrapeCommand(opts: ScrapeCommandOpts): Promise<void> {
  const db = createDbClient({ connectionString: opts.databaseUrl });

  opts.logger.warn('scrapers_wiring_pending', {
    hint: 'Conectar scrapeZap/scrapeVivaReal/scrapeOlx via job-config (fase 5)',
  });

  const scrapers: Record<string, ScraperFn> = {};
  for (const source of opts.sources) {
    // eslint-disable-next-line @typescript-eslint/require-await
    scrapers[source] = async function* (): AsyncGenerator<RawListing, void, void> {
      // Stub: produz zero itens até o wire real chegar.
      return;
    };
  }

  const result = await runScrape({
    sources: opts.sources,
    scrapers,
    normalize,
    dedupe: (arr) => dedupe(arr).clusters.map((c) => c.representative),
    db,
    repos: {
      listings: listingRepoAdapter,
      properties: propertyRepoAdapter,
      errors: scrapeErrorRepoAdapter,
    },
    logger: opts.logger,
    maxPerSource: opts.max,
  });

  opts.logger.info('scrape_command_result', { ...result });
}
