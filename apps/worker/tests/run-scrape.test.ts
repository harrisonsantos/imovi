import { describe, it, expect, vi } from 'vitest';

import type { NormalizedListing, RawListing, ListingSource } from '@imovi/shared';

import { parseRobotsTxt } from '@imovi/scrapers';
import { runScrape, listingKey, type RunScrapeDeps } from '../src/pipeline/run-scrape.js';
import { buildScraper } from '../src/commands/scrape.js';
import { silentLogger } from '../src/logger.js';

/** Helpers de factory para testes — reduzem ruído nas asserts. */
function makeRaw(source: ListingSource, id: string): RawListing {
  return {
    source,
    sourceListingId: id,
    url: `https://example.com/${source}/${id}`,
    price: 500000,
    operation: 'sale',
    area: 60,
    bedrooms: 2,
    bathrooms: 1,
    parking: 1,
    propertyType: 'apartment',
    scrapedAt: new Date('2026-04-15T12:00:00Z'),
    partial: false,
  };
}

function makeNormalized(id: string, area = 60): NormalizedListing {
  return {
    source: 'zap',
    sourceListingId: id,
    url: `https://example.com/${id}`,
    price: 500000,
    operation: 'sale',
    area,
    bedrooms: 2,
    bathrooms: 1,
    parking: 1,
    propertyType: 'apartment',
    scrapedAt: new Date('2026-04-15T12:00:00Z'),
    partial: false,
    addressNormalized: {
      street: 'Rua X',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      cep: '01000-000',
    },
  };
}

async function* genFromArr<T>(arr: T[]): AsyncGenerator<T, void, void> {
  for (const item of arr) yield item;
}

async function* throwingGen(msg: string): AsyncGenerator<RawListing, void, void> {
  // Emite nada e lança — simula falha no meio do scraping.
  yield* [];
  throw new Error(msg);
}

function makeDeps(overrides: Partial<RunScrapeDeps>): RunScrapeDeps {
  return {
    sources: ['zap'],
    scrapers: {},
    normalize: (raw) => makeNormalized(raw.sourceListingId),
    dedupe: (arr) => arr,
    db: {},
    repos: {
      listings: { upsertBatch: vi.fn(async () => 1) },
      properties: { upsertFromListing: vi.fn(async () => ({ id: 'test-prop-id' })) },
      errors: { record: vi.fn(async () => {}) },
    },
    logger: silentLogger,
    ...overrides,
  };
}

describe('runScrape', () => {
  it('preserves every source listing and shares one property per cluster', async () => {
    const stored: Array<{ source: string; propertyId: string | undefined }> = [];
    const propUpsert = vi.fn(async () => ({ id: 'shared-property' }));
    const deps = makeDeps({
      sources: ['zap', 'vivareal'],
      scrapers: {
        zap: () => genFromArr([makeRaw('zap', '1')]),
        vivareal: () => genFromArr([makeRaw('vivareal', '1')]),
      },
      normalize: (raw) => ({ ...makeNormalized(raw.sourceListingId), source: raw.source }),
      dedupe: (arr) => ({ clusters: [{ representative: arr[0]!, listings: arr }] }),
      repos: {
        listings: {
          upsertBatch: vi.fn(async (_db, rows, ids) => {
            for (const row of rows)
              stored.push({ source: row.source, propertyId: ids?.get(listingKey(row)) });
            return rows.length;
          }),
        },
        properties: { upsertFromListing: propUpsert },
        errors: { record: vi.fn(async () => {}) },
      },
    });
    const result = await runScrape(deps);
    expect(result.persisted).toBe(2);
    expect(propUpsert).toHaveBeenCalledTimes(1);
    expect(stored).toEqual([
      { source: 'zap', propertyId: 'shared-property' },
      { source: 'vivareal', propertyId: 'shared-property' },
    ]);
  });

  it('does not count a listing as persisted when its write fails', async () => {
    const deps = makeDeps({ scrapers: { zap: () => genFromArr([makeRaw('zap', '1')]) } });
    deps.repos.listings.upsertBatch = vi.fn(async () => {
      throw new Error('write failed');
    });
    const result = await runScrape(deps);
    expect(result.persisted).toBe(0);
    expect(result.errors).toBe(1);
  });

  it('records empty source results as source failure', async () => {
    const deps = makeDeps({ scrapers: { zap: () => genFromArr([]) } });
    const result = await runScrape(deps);
    expect(result.errors).toBe(1);
    expect(deps.repos.errors.record).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({ source: 'zap', message: 'scraper_empty_result' }),
    );
  });
  it('orquestra dois sources, descarta inválidos no normalize, dedupa e persiste', async () => {
    const zapItems = [makeRaw('zap', 'z1'), makeRaw('zap', 'z2')];
    const vivaItems = [makeRaw('vivareal', 'v1')];

    const listingsUpsert = vi.fn(async () => 1);
    const propUpsert = vi.fn(async () => ({ id: 'test-prop-id' }));

    const deps = makeDeps({
      sources: ['zap', 'vivareal'],
      scrapers: {
        zap: () => genFromArr(zapItems),
        vivareal: () => genFromArr(vivaItems),
      },
      // Normalizer rejeita o 'z2'.
      normalize: (raw) =>
        raw.sourceListingId === 'z2' ? null : makeNormalized(raw.sourceListingId),
      // Dedupe remove duplicata "v1" vs "z1" (simula equivalência).
      dedupe: (arr) => arr.slice(0, arr.length - 1),
      repos: {
        listings: { upsertBatch: listingsUpsert },
        properties: { upsertFromListing: propUpsert },
        errors: { record: vi.fn(async () => {}) },
      },
    });

    const result = await runScrape(deps);

    expect(result.scraped).toBe(3);
    expect(result.normalized).toBe(2); // z2 rejeitado
    expect(result.deduped).toBe(1); // dedupe removeu 1
    expect(result.persisted).toBe(1);
    expect(result.errors).toBe(0);
    expect(listingsUpsert).toHaveBeenCalledOnce();
    expect(propUpsert).toHaveBeenCalledOnce();
  });

  it('erro em um source não impede o outro e registra via errors.record', async () => {
    const record = vi.fn(async () => {});

    const deps = makeDeps({
      sources: ['zap', 'vivareal'],
      scrapers: {
        zap: () => throwingGen('zap boom'),
        vivareal: () => genFromArr([makeRaw('vivareal', 'v1')]),
      },
      repos: {
        listings: { upsertBatch: vi.fn(async () => 1) },
        properties: { upsertFromListing: vi.fn(async () => ({ id: 'test-prop-id' })) },
        errors: { record },
      },
    });

    const result = await runScrape(deps);

    expect(result.errors).toBeGreaterThanOrEqual(1);
    expect(result.scraped).toBe(1);
    expect(result.persisted).toBe(1);
    expect(record).toHaveBeenCalledOnce();
    const call = record.mock.calls[0] as unknown as [unknown, { source: string; message: string }];
    expect(call[1]).toMatchObject({ source: 'zap', message: 'zap boom' });
  });

  it('não mata a source quando normalize lança; conta em rejected', async () => {
    const deps = makeDeps({
      sources: ['zap'],
      scrapers: {
        zap: () => genFromArr([makeRaw('zap', 'z1'), makeRaw('zap', 'z2')]),
      },
      normalize: (raw) => {
        if (raw.sourceListingId === 'z1') throw new Error('sem CEP');
        return makeNormalized(raw.sourceListingId);
      },
      repos: {
        listings: { upsertBatch: vi.fn(async () => 1) },
        properties: { upsertFromListing: vi.fn(async () => ({ id: 'test-prop-id' })) },
        errors: { record: vi.fn(async () => {}) },
      },
    });

    const result = await runScrape(deps);

    expect(result.scraped).toBe(2);
    expect(result.normalized).toBe(1);
    expect(result.rejected).toBe(1);
    expect(result.errors).toBe(0);
    expect(result.persisted).toBe(1);
  });

  it('respeita maxPerSource', async () => {
    const many = Array.from({ length: 10 }, (_, i) => makeRaw('zap', `z${i}`));
    const deps = makeDeps({
      sources: ['zap'],
      scrapers: { zap: () => genFromArr(many) },
      maxPerSource: 3,
    });

    const result = await runScrape(deps);

    expect(result.scraped).toBe(3);
    expect(result.normalized).toBe(3);
  });

  it.each([
    {
      reason: 'robots_disallowed',
      url: 'https://www.zapimoveis.com.br/venda/imoveis/pr+curitiba/?pagina=1',
    },
    {
      reason: 'http_status_403',
      url: 'https://www.vivareal.com.br/venda/parana/curitiba/?pagina=1',
    },
    {
      reason: 'http_status_429',
      url: 'https://www.olx.com.br/imoveis/venda/estado-pr/cidade-curitiba?o=1',
    },
    {
      reason: 'parser_zero_items',
      url: 'https://www.zapimoveis.com.br/venda/imoveis/pr+curitiba/?pagina=1',
    },
  ])(
    'preserva url real e motivo específico ($reason) quando scraper lança erro diagnóstico',
    async ({ reason, url }) => {
      const record = vi.fn(async () => {});
      const err = Object.assign(new Error(reason), { reason, url, page: 1 });

      const deps = makeDeps({
        sources: ['zap'],
        scrapers: {
          zap: async function* () {
            yield* [];
            throw err;
          },
        },
        repos: {
          listings: { upsertBatch: vi.fn(async () => 1) },
          properties: { upsertFromListing: vi.fn(async () => ({ id: 'test-prop-id' })) },
          errors: { record },
        },
      });

      const result = await runScrape(deps);

      expect(result.errors).toBe(1);
      expect(record).toHaveBeenCalledWith(
        deps.db,
        expect.objectContaining({
          source: 'zap',
          message: reason,
          url,
        }),
      );
    },
  );

  it('preserva url real e motivo específico via ctx.onDiagnostic quando source retorna 0 itens sem lançar', async () => {
    const record = vi.fn(async () => {});
    const targetUrl = 'https://www.olx.com.br/imoveis/venda/estado-pr/cidade-curitiba?o=1';

    const deps = makeDeps({
      sources: ['olx'],
      scrapers: {
        olx: async function* (ctx) {
          ctx.onDiagnostic?.({ reason: 'parser_zero_items', url: targetUrl });
          yield* [];
        },
      },
      repos: {
        listings: { upsertBatch: vi.fn(async () => 1) },
        properties: { upsertFromListing: vi.fn(async () => ({ id: 'test-prop-id' })) },
        errors: { record },
      },
    });

    const result = await runScrape(deps);

    expect(result.errors).toBe(1);
    expect(record).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({
        source: 'olx',
        message: 'parser_zero_items',
        url: targetUrl,
      }),
    );
  });

  it('integra buildScraper dos 3 portais com runScrape registrando url e motivo específico', async () => {
    const record = vi.fn(async () => {});
    const disallowAll = parseRobotsTxt('User-agent: *\nDisallow: /');
    const policies = {
      zap: disallowAll,
      vivareal: disallowAll,
      olx: disallowAll,
    };

    const deps = makeDeps({
      sources: ['zap', 'vivareal', 'olx'],
      scrapers: {
        zap: buildScraper('zap', 'pr+curitiba', 1, policies),
        vivareal: buildScraper('vivareal', 'parana/curitiba', 1, policies),
        olx: buildScraper('olx', 'pr/cidade-curitiba', 1, policies),
      },
      repos: {
        listings: { upsertBatch: vi.fn(async () => 1) },
        properties: { upsertFromListing: vi.fn(async () => ({ id: 'test-prop-id' })) },
        errors: { record },
      },
    });

    const result = await runScrape(deps);

    expect(result.errors).toBe(3);
    expect(record).toHaveBeenCalledTimes(3);
    expect(record).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({
        source: 'zap',
        message: 'robots_disallowed',
        url: 'https://www.zapimoveis.com.br/venda/imoveis/pr+curitiba/?pagina=1',
      }),
    );
    expect(record).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({
        source: 'vivareal',
        message: 'robots_disallowed',
        url: 'https://www.vivareal.com.br/venda/parana/curitiba/?pagina=1',
      }),
    );
    expect(record).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({
        source: 'olx',
        message: 'robots_disallowed',
        url: 'https://www.olx.com.br/imoveis/venda/estado-pr/cidade-curitiba?o=1',
      }),
    );
  });
});
