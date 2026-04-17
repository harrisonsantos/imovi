import type { RawListing } from '@imovi/shared';
import { resolveScraperDeps } from '../core/scraper-setup.js';
import type { ScrapeOptions } from '../core/types.js';
import { parseOlxListingPage } from './parser.js';

const HOST = 'www.olx.com.br';

/**
 * Adapter de scraping da OLX. Paginação preguiçosa, rate limit + robots.txt
 * + User-Agent identificável.
 */
export async function* scrapeOlx(opts: ScrapeOptions): AsyncIterable<RawListing> {
  const { fetcher, limiter, policy, userAgent } = await resolveScraperDeps(HOST, opts);
  const maxPages = opts.maxPages ?? 1;
  // OLX usa 'venda' para sale e 'aluguel' para rent em URLs de imóveis.
  const operationPath = opts.operation === 'rent' ? 'aluguel' : 'venda';

  for (let page = 1; page <= maxPages; page++) {
    const pathPart = `/imoveis/${operationPath}/estado-${opts.location}`;
    if (!policy.isAllowed(userAgent, pathPart)) return;

    await limiter.acquire(HOST);
    const url = `https://${HOST}${pathPart}?o=${page}`;
    const res = await fetcher.get(url);
    if (!res.ok) return;
    const html = await res.text();
    const listings = parseOlxListingPage(html, { sourceUrl: url, scrapedAt: new Date() });
    if (listings.length === 0) return;
    for (const l of listings) yield l;
  }
}
