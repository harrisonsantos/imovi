import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CuritibaIptuAdapter, MemoryIptuCache } from '@imovi/enrichment';
import { runEnrichIptuCommand } from '../src/commands/enrich-iptu.js';
import { runCli } from '../src/cli.js';

const db = vi.hoisted(() => ({ list: vi.fn(), record: vi.fn() }));
vi.mock('@imovi/db', () => ({
  createDbClient: () => ({}),
  propertyRepo: { listWithoutFreshIptu: db.list },
  iptuRepo: { record: db.record },
}));
const property = {
  id: 'imovel-sintetico',
  street: 'Rua Sintética',
  number: '10',
  city: 'Curitiba',
  state: 'PR',
  cep: '80000-000',
};
const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const endpoint = 'https://api.infosimples.com/api/v2/consultas/contrato-sintetico';
const token = 'token-sintetico';
// Fixture local ao pacote para respeitar o rootDir do worker; sem dados reais.
const curitibaResponse = {
  code: 200,
  data: [
    {
      inscricao_imobiliaria: '00.0.0000.0000.00-0',
      exercicio: '2026',
      area_construida: '123,45',
      valor_venal: 'R$ 456.789,12',
      iptu_valor_total: '1.234,56',
      proprietario: 'PESSOA SINTETICA',
      cpf: 'CPF-SINTETICO',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-05T12:00:00Z'));
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Rede proibida');
    }),
  );
  db.list.mockResolvedValue([property]);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('enrich IPTU: CLI → adapter → pipeline → persistência', () => {
  it('injeta cliente configurado por env, respeita limit e persiste somente projeção fiscal', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(curitibaResponse)));
    expect(
      await runCli(['enrich-iptu', '--limit', '2'], {
        env: {
          DATABASE_URL: 'postgres://sintetico',
          INFOSIMPLES_TOKEN: token,
          INFOSIMPLES_CURITIBA_ENDPOINT: endpoint,
        },
        exit: vi.fn(),
        logger,
        runScrape: vi.fn(),
        runEnrichIptu: runEnrichIptuCommand,
        iptuFetch: fetchFn,
      }),
    ).toBe(0);
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(db.list).toHaveBeenCalledWith(expect.anything(), { limit: 2 });
    expect(db.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        propertyId: property.id,
        source: 'infosimples',
        taxYear: 2026,
        assessedValue: '456789.12',
        iptuAmount: '1234.56',
        rawPayload: expect.objectContaining({ areaM2: 123.45 }),
      }),
    );
    expect(
      JSON.stringify([
        db.record.mock.calls,
        logger.info.mock.calls,
        logger.warn.mock.calls,
        logger.error.mock.calls,
      ]),
    ).not.toMatch(/PESSOA|CPF|token-sintetico/);
  });

  it('cache injetado evita chamada e sanitiza entrada legada antes do banco', async () => {
    const getIptu = vi.fn();
    await runEnrichIptuCommand({
      databaseUrl: 'postgres://sintetico',
      logger,
      taxYear: 2026,
      curitiba: { getIptu },
      cache: {
        getFresh: async () => ({
          source: 'infosimples',
          taxYear: 2026,
          assessedValue: 1000,
          iptuAmount: 100,
          fetchedAt: new Date(),
          rawPayload: { cpf: 'CPF-SINTETICO' },
        }),
        put: vi.fn(),
      },
    });
    expect(getIptu).not.toHaveBeenCalled();
    expect(db.record).toHaveBeenCalledOnce();
    expect(JSON.stringify(db.record.mock.calls)).not.toContain('CPF');
  });

  it('cache da execução evita consulta duplicada no lote', async () => {
    db.list.mockResolvedValue([property, { ...property, id: 'outro-id' }]);
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(JSON.stringify(curitibaResponse)));
    const curitiba = new CuritibaIptuAdapter({ apiToken: token, endpoint, fetchFn });
    await runEnrichIptuCommand({
      databaseUrl: 'postgres://sintetico',
      logger,
      taxYear: 2026,
      curitiba,
    });
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(db.record).toHaveBeenCalledTimes(2);
  });

  it.each(['Londrina', 'Curitiba'])(
    'sem adapter para %s registra cobertura inexistente e CLI falha',
    async (city) => {
      db.list.mockResolvedValue([{ ...property, city }]);
      const fetchFn = vi.fn<typeof fetch>();
      expect(
        await runCli(['enrich-iptu'], {
          env: { DATABASE_URL: 'postgres://sintetico', INFOSIMPLES_TOKEN: token },
          exit: vi.fn(),
          logger,
          runScrape: vi.fn(),
          runEnrichIptu: runEnrichIptuCommand,
          iptuFetch: fetchFn,
        }),
      ).toBe(1);
      expect(logger.warn).toHaveBeenCalledWith(
        'fetchIptu: cobertura inexistente',
        expect.any(Object),
      );
      expect(db.record).not.toHaveBeenCalled();
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );

  it('429 não gera retry, cache ou persistência, e sinaliza falha', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429 }));
    const cache = new MemoryIptuCache();
    const put = vi.spyOn(cache, 'put');
    await expect(
      runEnrichIptuCommand({
        databaseUrl: 'postgres://sintetico',
        logger,
        taxYear: 2026,
        cache,
        curitiba: new CuritibaIptuAdapter({ apiToken: token, endpoint, fetchFn }),
      }),
    ).rejects.toThrow('1');
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(put).not.toHaveBeenCalled();
    expect(db.record).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { INFOSIMPLES_TOKEN: '   ' },
    {
      INFOSIMPLES_TOKEN: token,
      INFOSIMPLES_CURITIBA_ENDPOINT: 'http://api.infosimples.com/consulta',
    },
    { INFOSIMPLES_TOKEN: token, INFOSIMPLES_CURITIBA_ENDPOINT: 'https://outro.test/consulta' },
    {
      INFOSIMPLES_TOKEN: token,
      INFOSIMPLES_CURITIBA_ENDPOINT: 'https://api.infosimples.com/consulta?token=segredo',
    },
  ])('configuração inválida falha antes de consultar: %j', async (env) => {
    const command = vi.fn();
    expect(
      await runCli(['enrich-iptu'], {
        env: { DATABASE_URL: 'postgres://sintetico', ...env },
        exit: vi.fn(),
        logger,
        runScrape: vi.fn(),
        runEnrichIptu: command,
      }),
    ).toBe(1);
    expect(command).not.toHaveBeenCalled();
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('segredo');
  });
});
