import {
  normalize,
  dedupe,
  matchNeighborhood,
  type NeighborhoodCandidate,
} from '@imovi/normalizer';
import {
  createDbClient,
  listingRepo,
  propertyRepo,
  neighborhoodRepo,
  cityRepo,
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
import { runAggregateNeighborhoodsCommand } from './aggregate-neighborhoods.js';
import {
  runScrape,
  listingKey,
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

/** Job de scraping de uma cidade: location strings por portal. */
export interface CityJob {
  name: string;
  state: string;
  locations: Partial<Record<ListingSource, string>>;
}

/**
 * Fallback quando a tabela `cities` está vazia (bootstrap/dev sem seed).
 * Cada portal formata URL-de-listagem de jeito próprio — a string em
 * `locations` é interpolada direto na URL pelo adapter.
 */
const DEFAULT_CITY_JOBS: CityJob[] = [
  {
    name: 'Curitiba',
    state: 'PR',
    locations: {
      zap: 'pr+curitiba',
      vivareal: 'parana/curitiba',
      olx: 'pr/cidade-curitiba',
    },
  },
];

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
      propertyId: propertyIds?.get(listingKey(l)) ?? null,
    }));
    return (await listingRepo.upsertBatch(db as DbClient, rows)).length;
  },
};

/**
 * Adapter de property repo com matcher de bairro: resolve neighborhood_id a
 * partir do addressRaw contra os bairros da cidade (carregados uma vez por job).
 */
function makePropertyRepoAdapter(
  neighborhoodsByCity: Map<string, NeighborhoodCandidate[]>,
): PipelinePropertyRepo {
  return {
    async upsertFromListing(db, listing) {
      const city = listing.addressNormalized.city;
      const candidates = neighborhoodsByCity.get(city) ?? [];
      const neighborhoodId = listing.addressRaw
        ? matchNeighborhood(listing.addressRaw, city, candidates)
        : undefined;
      const prop = await propertyRepo.upsertFromListing(
        db as DbClient,
        listing,
        neighborhoodId ? { neighborhoodId } : undefined,
      );
      return { id: prop.id };
    },
  };
}

export const scrapeErrorRepoAdapter: PipelineScrapeErrorRepo = {
  async record(db, err) {
    await scrapeErrorRepo.record(db as DbClient, {
      source: err.source,
      url: err.url ?? null,
      error: err.message,
      occurredAt: err.at,
    });
  },
};

/**
 * Mapeia ListingSource → factory de AsyncIterable<RawListing>, aplicando
 * `maxPages` e a policy de robots.txt previamente carregada.
 */
export function buildScraper(
  source: ListingSource,
  location: string,
  maxPages: number,
  policyBySource: Record<ListingSource, RobotsPolicy>,
): ScraperFn {
  const policy = policyBySource[source];

  return async function* (ctx): AsyncGenerator<RawListing, void, void> {
    const opts = {
      location,
      operation: 'sale',
      maxPages,
      robotsPolicy: policy,
      onDiagnostic: (diag: { reason: string; url: string }) => {
        ctx?.onDiagnostic?.({ reason: diag.reason, url: diag.url });
      },
    } as const;
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

/** Resolve as cidades a scrapear: tabela `cities` ativa, com fallback default. */
async function loadCityJobs(db: DbClient, logger: Logger): Promise<CityJob[]> {
  try {
    const active = await cityRepo.listActive(db);
    if (active.length > 0) {
      return active.map((c) => ({
        name: c.name,
        state: c.state,
        locations: (c.portalLocations ?? {}) as Partial<Record<ListingSource, string>>,
      }));
    }
  } catch (err) {
    logger.warn('cities_table_unavailable', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  logger.warn('cities_fallback_default', { city: 'Curitiba' });
  return DEFAULT_CITY_JOBS;
}

export async function runScrapeCommand(opts: ScrapeCommandOpts): Promise<void> {
  const db = createDbClient({ connectionString: opts.databaseUrl });
  const maxPages = opts.maxPagesPerSource ?? opts.pages ?? 3;

  // Carrega robots.txt em paralelo — 3 GETs de cold start. Cada scraper usa
  // a policy passada; se falhar, `fetchRobotsPolicy` devolve "allow all".
  const policyEntries = await Promise.all(
    opts.sources.map(async (src) => [src, await fetchRobotsPolicy(HOSTS[src])] as const),
  );
  const policyBySource = Object.fromEntries(policyEntries) as Record<ListingSource, RobotsPolicy>;

  const cityJobs = await loadCityJobs(db, opts.logger);

  const totals = {
    scraped: 0,
    normalized: 0,
    rejected: 0,
    deduped: 0,
    persisted: 0,
    errors: 0,
  };

  for (const job of cityJobs) {
    const scrapers: Record<string, ScraperFn> = {};
    for (const source of opts.sources) {
      const location = job.locations[source];
      if (!location) {
        opts.logger.warn('city_missing_portal_location', { city: job.name, source });
        continue;
      }
      scrapers[source] = buildScraper(source, location, maxPages, policyBySource);
    }
    if (Object.keys(scrapers).length === 0) {
      totals.errors += 1;
      continue;
    }

    opts.logger.info('scrape_command_start', {
      sources: Object.keys(scrapers),
      city: job.name,
      state: job.state,
      maxPages,
    });

    // Carrega bairros da cidade uma vez por job — usados pelo matcher de
    // neighborhood_id no upsert de properties.
    const neighborhoodsByCity = new Map<string, NeighborhoodCandidate[]>();
    neighborhoodsByCity.set(job.name, await neighborhoodRepo.listByCity(db, job.name, job.state));

    const result = await runScrape({
      sources: Object.keys(scrapers) as ListingSource[],
      scrapers,
      normalize,
      dedupe,
      db,
      repos: {
        listings: listingRepoAdapter,
        properties: makePropertyRepoAdapter(neighborhoodsByCity),
        errors: scrapeErrorRepoAdapter,
      },
      logger: opts.logger,
      maxPerSource: opts.max,
    });

    opts.logger.info('scrape_city_result', { city: job.name, ...result });
    totals.scraped += result.scraped;
    totals.normalized += result.normalized;
    totals.rejected += result.rejected;
    totals.deduped += result.deduped;
    totals.persisted += result.persisted;
    totals.errors += result.errors;
  }

  opts.logger.info('scrape_command_result', { ...totals });
  // Aggregation is part of the scrape job, and failure must fail the cron.
  await runAggregateNeighborhoodsCommand({ databaseUrl: opts.databaseUrl, logger: opts.logger });
  if (totals.errors > 0 || totals.persisted === 0) {
    throw new Error(
      `Scrape incomplete: ${totals.errors} errors, ${totals.persisted} stored listings`,
    );
  }
}
