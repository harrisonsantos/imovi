import type { RawListing } from '@imovi/shared';
import { Fetcher } from '../core/fetcher.js';
import { RateLimiter } from '../core/rate-limiter.js';
import type { ScrapeOptions } from '../core/types.js';
import { parseOlxListingPage } from './parser.js';

const HOST = 'www.olx.com.br';

/**
 * Adapter de scraping da OLX. Paginação preguiçosa, respeita rate limit.
 * TODO: checar robots.txt antes do primeiro fetch.
 */
export async function* scrapeOlx(opts: ScrapeOptions): AsyncIterable<RawListing> {
  const fetcher = opts.fetcher ?? new Fetcher();
  const limiter = opts.rateLimiter ?? new RateLimiter({ minIntervalMs: 1000 });
  const maxPages = opts.maxPages ?? 1;
  // OLX usa 'venda' para sale e 'aluguel' para rent em URLs de imóveis.
  const operationPath = opts.operation === 'rent' ? 'aluguel' : 'venda';

  for (let page = 1; page <= maxPages; page++) {
    await limiter.acquire(HOST);
    const url = `https://${HOST}/imoveis/${operationPath}/estado-${opts.location}?o=${page}`;
    const res = await fetcher.get(url);
    if (!res.ok) return;
    const html = await res.text();
    const listings = parseOlxListingPage(html, { sourceUrl: url, scrapedAt: new Date() });
    if (listings.length === 0) return;
    for (const l of listings) yield l;
  }
}
