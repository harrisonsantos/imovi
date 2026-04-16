import type { RawListing } from '@imovi/shared';
import { Fetcher } from '../core/fetcher.js';
import { RateLimiter } from '../core/rate-limiter.js';
import type { ScrapeOptions } from '../core/types.js';
import { parseVivaRealListingPage } from './parser.js';

const HOST = 'www.vivareal.com.br';

/**
 * Adapter de scraping do VivaReal. Paginação preguiçosa, respeita rate limit.
 * TODO: checar robots.txt antes do primeiro fetch.
 */
export async function* scrapeVivaReal(opts: ScrapeOptions): AsyncIterable<RawListing> {
  const fetcher = opts.fetcher ?? new Fetcher();
  const limiter = opts.rateLimiter ?? new RateLimiter({ minIntervalMs: 1000 });
  const maxPages = opts.maxPages ?? 1;
  const operationPath = opts.operation === 'rent' ? 'aluguel' : 'venda';

  for (let page = 1; page <= maxPages; page++) {
    await limiter.acquire(HOST);
    const url = `https://${HOST}/${operationPath}/${opts.location}/?pagina=${page}`;
    const res = await fetcher.get(url);
    if (!res.ok) return;
    const html = await res.text();
    const listings = parseVivaRealListingPage(html, { sourceUrl: url, scrapedAt: new Date() });
    if (listings.length === 0) return;
    for (const l of listings) yield l;
  }
}
