import { normalize, dedupe } from '@imovi/normalizer';
import {
  createDbClient,
  listingRepo,
  propertyRepo,
  scrapeErrorRepo,
  type DbClient,
} from '@imovi/db';
import {
  scrapeZap,
  scrapeVivaReal,
  scrapeOlx,
  fetchRobotsPolicy,
  type RobotsPolicy,
} from '@imovi/scrapers';

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
  /** Máximo de páginas por portal (Default: 3). */
  maxPagesPerSource?: number;
  /** Alias CLI para maxPagesPerSource (--pages flag). */
  pages?: number;
  /** Máximo de listings agregados por portal (Default: ilimitado; usado em tests). */
  max?: number;
  databaseUrl: string;
  logger: Logger;
}

/**
 * Config de busca por source. Cada portal formata URL-de-listagem de jeito
 * próprio — a string em `location` é interpolada direto na URL pelo adapter.
 *
 * MVP: Curitiba/PR, venda. Expansão futura passa a ler de KV/DB.
 */
const CURITIBA_JOB: Record<
  ListingSource,
  { location: string; operation: 'sale' | 'rent' }
> = {
  zap: { location: 'pr+curitiba', operation: 'sale' },
  vivareal: { location: 'parana/curitiba', operation: 'sale' },
  olx: { location: 'pr/cidade-curitiba', operation: 'sale' },
};

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
  async upsertBatch(db, listings, propertyIds) {
    const rows = listings.map((l) => ({
      ...toDbListingRow(l),
      propertyId: propertyIds?.get(l.sourceListingId) ?? null,
    }));
    await listingRepo.upsertBatch(db as DbClient, rows);
  },
};

const propertyRepoAdapter: PipelinePropertyRepo = {
  async upsertFromListing(db, listing) {
    const prop = await propertyRepo.upsertFromListing(db as DbClient, listing);
    return { id: prop.id };
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
 * Mapeia ListingSource → factory de AsyncIterable<RawListing>, aplicando
 * `maxPages` e a policy de robots.txt previamente carregada.
 */
function buildScraper(
  source: ListingSource,
  maxPages: number,
  policyBySource: Record<ListingSource, RobotsPolicy>,
): ScraperFn {
  const job = CURITIBA_JOB[source];
  const policy = policyBySource[source];
  const opts = {
    location: job.location,
    operation: job.operation,
    maxPages,
    robotsPolicy: policy,
  } as const;

  return async function* (): AsyncGenerator<RawListing, void, void> {
    const iterable =
      source === 'zap'
        ? scrapeZap(opts)
        : source === 'vivareal'
          ? scrapeVivaReal(opts)
          : scrapeOlx(opts);
    for await (const raw of iterable) yield raw;
  };
}

/** Hosts alvo dos 3 portais — usado pra pré-carregar robots.txt. */
const HOSTS: Record<ListingSource, string> = {
  zap: 'www.zapimoveis.com.br',
  vivareal: 'www.vivareal.com.br',
  olx: 'www.olx.com.br',
};

export async function runScrapeCommand(opts: ScrapeCommandOpts): Promise<void> {
  const db = createDbClient({ connectionString: opts.databaseUrl });
  const maxPages = opts.maxPagesPerSource ?? opts.pages ?? 3;

  // Carrega robots.txt em paralelo — 3 GETs de cold start. Cada scraper usa
  // a policy passada; se falhar, `fetchRobotsPolicy` devolve "allow all".
  const policyEntries = await Promise.all(
    opts.sources.map(async (src) => [src, await fetchRobotsPolicy(HOSTS[src])] as const),
  );
  const policyBySource = Object.fromEntries(policyEntries) as Record<
    ListingSource,
    RobotsPolicy
  >;

  const scrapers: Record<string, ScraperFn> = {};
  for (const source of opts.sources) {
    scrapers[source] = buildScraper(source, maxPages, policyBySource);
  }

  opts.logger.info('scrape_command_start', {
    sources: opts.sources,
    city: 'curitiba',
    state: 'pr',
    maxPages,
  });

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
