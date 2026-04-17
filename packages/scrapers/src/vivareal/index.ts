import type { RawListing } from '@imovi/shared';
import { resolveScraperDeps } from '../core/scraper-setup.js';
import type { ScrapeOptions } from '../core/types.js';
import { parseVivaRealListingPage } from './parser.js';

const HOST = 'www.vivareal.com.br';

/**
 * Adapter de scraping do VivaReal. Paginação preguiçosa, rate limit +
 * robots.txt + User-Agent identificável.
 */
export async function* scrapeVivaReal(opts: ScrapeOptions): AsyncIterable<RawListing> {
  const { fetcher, limiter, policy, userAgent } = await resolveScraperDeps(HOST, opts);
  const maxPages = opts.maxPages ?? 1;
  const operationPath = opts.operation === 'rent' ? 'aluguel' : 'venda';

  for (let page = 1; page <= maxPages; page++) {
    const pathPart = `/${operationPath}/${opts.location}/`;
    if (!policy.isAllowed(userAgent, pathPart)) return;

    await limiter.acquire(HOST);
    const url = `https://${HOST}${pathPart}?pagina=${page}`;
    const res = await fetcher.get(url);
    if (!res.ok) return;
    const html = await res.text();
    const listings = parseVivaRealListingPage(html, { sourceUrl: url, scrapedAt: new Date() });
    if (listings.length === 0) return;
    for (const l of listings) yield l;
  }
}
