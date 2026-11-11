import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { RawListing } from '@imovi/shared';
import {
  scrapeZap,
  scrapeVivaReal,
  scrapeOlx,
  Fetcher,
  RateLimiter,
  parseRobotsTxt,
  ScrapeDiagnosticError,
  type ScrapeDiagnostic,
  type ScrapeOptions,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = (p: string) => readFileSync(join(__dirname, '__fixtures__', p), 'utf8');

async function collect(iter: AsyncIterable<RawListing>): Promise<RawListing[]> {
  const out: RawListing[] = [];
  for await (const item of iter) out.push(item);
  return out;
}

function fastLimiter(): RateLimiter {
  return new RateLimiter({ minIntervalMs: 0 });
}

interface AdapterCase {
  name: 'zap' | 'vivareal' | 'olx';
  scrape: (opts: ScrapeOptions) => AsyncIterable<RawListing>;
  location: string;
  expectedPage1Url: string;
  expectedPage2Url: string;
  fixturePath: string;
}

const ADAPTER_CASES: AdapterCase[] = [
  {
    name: 'zap',
    scrape: scrapeZap,
    location: 'pr+curitiba',
    expectedPage1Url: 'https://www.zapimoveis.com.br/venda/imoveis/pr+curitiba/?pagina=1',
    expectedPage2Url: 'https://www.zapimoveis.com.br/venda/imoveis/pr+curitiba/?pagina=2',
    fixturePath: 'zap/listing-page-1.html',
  },
  {
    name: 'vivareal',
    scrape: scrapeVivaReal,
    location: 'parana/curitiba',
    expectedPage1Url: 'https://www.vivareal.com.br/venda/parana/curitiba/?pagina=1',
    expectedPage2Url: 'https://www.vivareal.com.br/venda/parana/curitiba/?pagina=2',
    fixturePath: 'vivareal/listing-page-1.html',
  },
  {
    name: 'olx',
    scrape: scrapeOlx,
    location: 'pr/cidade-curitiba',
    expectedPage1Url: 'https://www.olx.com.br/imoveis/venda/estado-pr/cidade-curitiba?o=1',
    expectedPage2Url: 'https://www.olx.com.br/imoveis/venda/estado-pr/cidade-curitiba?o=2',
    fixturePath: 'olx/listing-page-1.html',
  },
];

describe.each(ADAPTER_CASES)('telemetria diagnóstica do scraper ($name)', (tc) => {
  it('lança ScrapeDiagnosticError com robots_disallowed e URL real quando bloqueado pelo robots.txt na página 1', async () => {
    const transport = vi.fn(async () => new Response('ok', { status: 200 }));
    const fetcher = new Fetcher({ transport, maxRetries: 1, baseBackoffMs: 0 });
    const disallowAll = parseRobotsTxt('User-agent: *\nDisallow: /');
    const diagnostics: ScrapeDiagnostic[] = [];

    await expect(
      collect(
        tc.scrape({
          location: tc.location,
          operation: 'sale',
          maxPages: 1,
          fetcher,
          rateLimiter: fastLimiter(),
          robotsPolicy: disallowAll,
          onDiagnostic: (d) => diagnostics.push(d),
        }),
      ),
    ).rejects.toThrowError(
      expect.objectContaining({
        name: 'ScrapeDiagnosticError',
        message: 'robots_disallowed',
        reason: 'robots_disallowed',
        url: tc.expectedPage1Url,
        page: 1,
      }),
    );

    expect(transport).not.toHaveBeenCalled();
    expect(diagnostics).toEqual([
      {
        reason: 'robots_disallowed',
        url: tc.expectedPage1Url,
        page: 1,
      },
    ]);
  });

  it.each([403, 429])(
    'lança ScrapeDiagnosticError com http_status_%i e URL real quando HTTP falha na página 1',
    async (status) => {
      const transport = vi.fn(
        async () => new Response('Attention Required! | Cloudflare', { status }),
      );
      const fetcher = new Fetcher({
        transport,
        maxRetries: 1,
        baseBackoffMs: 0,
        sleep: async () => {},
      });
      const diagnostics: ScrapeDiagnostic[] = [];

      let caught: unknown;
      try {
        await collect(
          tc.scrape({
            location: tc.location,
            operation: 'sale',
            maxPages: 1,
            fetcher,
            rateLimiter: fastLimiter(),
            robotsPolicy: parseRobotsTxt(''),
            onDiagnostic: (d) => diagnostics.push(d),
          }),
        );
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(ScrapeDiagnosticError);
      expect(caught).toMatchObject({
        message: `http_status_${status}`,
        reason: `http_status_${status}`,
        url: tc.expectedPage1Url,
        page: 1,
        status,
      });
      expect(diagnostics).toEqual([
        {
          reason: `http_status_${status}`,
          url: tc.expectedPage1Url,
          page: 1,
          status,
        },
      ]);
    },
  );

  it('lança ScrapeDiagnosticError com parser_zero_items e URL real quando HTML 200 retorna 0 anúncios na página 1', async () => {
    const transport = vi.fn(
      async () => new Response('<!doctype html><html><body>sem cards</body></html>', { status: 200 }),
    );
    const fetcher = new Fetcher({ transport, maxRetries: 1, baseBackoffMs: 0 });
    const diagnostics: ScrapeDiagnostic[] = [];

    await expect(
      collect(
        tc.scrape({
          location: tc.location,
          operation: 'sale',
          maxPages: 1,
          fetcher,
          rateLimiter: fastLimiter(),
          robotsPolicy: parseRobotsTxt(''),
          onDiagnostic: (d) => diagnostics.push(d),
        }),
      ),
    ).rejects.toThrowError(
      expect.objectContaining({
        name: 'ScrapeDiagnosticError',
        message: 'parser_zero_items',
        reason: 'parser_zero_items',
        url: tc.expectedPage1Url,
        page: 1,
      }),
    );

    expect(diagnostics).toEqual([
      {
        reason: 'parser_zero_items',
        url: tc.expectedPage1Url,
        page: 1,
      },
    ]);
  });

  it('não lança erro quando a página 1 retorna itens e a página 2 retorna 0 itens (fim da paginação)', async () => {
    const page1Html = fx(tc.fixturePath);
    let callCount = 0;
    const transport = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response(page1Html, { status: 200 });
      }
      return new Response('<html><body>fim</body></html>', { status: 200 });
    });
    const fetcher = new Fetcher({ transport, maxRetries: 1, baseBackoffMs: 0 });
    const diagnostics: ScrapeDiagnostic[] = [];

    const items = await collect(
      tc.scrape({
        location: tc.location,
        operation: 'sale',
        maxPages: 2,
        fetcher,
        rateLimiter: fastLimiter(),
        robotsPolicy: parseRobotsTxt(''),
        onDiagnostic: (d) => diagnostics.push(d),
      }),
    );

    expect(items.length).toBeGreaterThan(0);
    expect(diagnostics).toEqual([
      {
        reason: 'parser_zero_items',
        url: tc.expectedPage2Url,
        page: 2,
      },
    ]);
  });
});
