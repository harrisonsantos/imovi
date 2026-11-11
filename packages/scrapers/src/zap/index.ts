import type { RawListing } from '@imovi/shared';
import { resolveScraperDeps } from '../core/scraper-setup.js';
import {
  ScrapeDiagnosticError,
  type ScrapeDiagnostic,
  type ScrapeOptions,
} from '../core/types.js';
import { parseZapListingPage } from './parser.js';

const HOST = 'www.zapimoveis.com.br';

/**
 * Adapter de scraping do Zap. Gera RawListings de forma preguiçosa por página.
 *
 * Respeita rate limit por host + robots.txt + envia User-Agent identificável.
 * Parser é puro e testado separadamente.
 */
export async function* scrapeZap(opts: ScrapeOptions): AsyncIterable<RawListing> {
  const { fetcher, limiter, policy, userAgent } = await resolveScraperDeps(HOST, opts);
  const maxPages = opts.maxPages ?? 1;
  const operationPath = opts.operation === 'rent' ? 'aluguel' : 'venda';

  for (let page = 1; page <= maxPages; page++) {
    const pathPart = `/${operationPath}/imoveis/${opts.location}/`;
    const url = `https://${HOST}${pathPart}?pagina=${page}`;
    if (!policy.isAllowed(userAgent, pathPart)) {
      const diag: ScrapeDiagnostic = { reason: 'robots_disallowed', url, page };
      opts.onDiagnostic?.(diag);
      if (page === 1) throw new ScrapeDiagnosticError(diag);
      return;
    }

    await limiter.acquire(HOST);
    const res = await fetcher.get(url);
    if (!res.ok) {
      const diag: ScrapeDiagnostic = {
        reason: `http_status_${res.status}`,
        url,
        page,
        status: res.status,
      };
      opts.onDiagnostic?.(diag);
      if (page === 1) throw new ScrapeDiagnosticError(diag);
      return;
    }
    const html = await res.text();
    const listings = parseZapListingPage(html, { sourceUrl: url, scrapedAt: new Date() });
    if (listings.length === 0) {
      const diag: ScrapeDiagnostic = { reason: 'parser_zero_items', url, page };
      opts.onDiagnostic?.(diag);
      if (page === 1) throw new ScrapeDiagnosticError(diag);
      return;
    }
    for (const l of listings) yield l;
  }
}
