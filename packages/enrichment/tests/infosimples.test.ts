import { describe, it, expect, vi } from 'vitest';
import type { NormalizedAddress } from '@imovi/shared';
import { InfoSimplesAdapter } from '../src/adapters/infosimples.js';
import type { Logger } from '../src/logger.js';

const address: NormalizedAddress = {
  street: 'Rua Exemplo',
  number: '123',
  neighborhood: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  cep: '01310-100',
};

function makeLogger(): Logger & {
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
} {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('InfoSimplesAdapter.getIptu', () => {
  it('não preserva dados pessoais nem erro contendo segredo', async () => {
    const logger = makeLogger();
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: [
          {
            numero_cadastro: '000',
            exercicio: 2026,
            valor_venal: '1000.00',
            proprietario: 'PESSOA SINTETICA',
            cpf: 'CPF-SINTETICO',
          },
        ],
      }),
    );
    const adapter = new InfoSimplesAdapter({ apiToken: 'token-sintetico', fetchFn, logger });
    const record = await adapter.getIptu(address, 2026);
    expect(record).not.toBeNull();
    expect(JSON.stringify(record)).not.toMatch(/PESSOA|CPF|proprietario/);
    fetchFn.mockRejectedValueOnce(new Error('token-sintetico CPF-SINTETICO'));
    expect(await adapter.getIptu(address, 2026)).toBeNull();
    expect(JSON.stringify(logger.error.mock.calls)).not.toMatch(/token-sintetico|CPF/);
  });

  it.each([{}, { data: [] }, { code: 600, data: [{ valor_venal: '1000' }] }])(
    'não aceita resposta sem resultado fiscal: %j',
    async (body) => {
      const adapter = new InfoSimplesAdapter({
        apiToken: 'tok',
        fetchFn: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(body)),
      });
      expect(await adapter.getIptu(address, 2026)).toBeNull();
    },
  );
  it('mapeia resposta OK para IptuRecord com valores corretos', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            valor_venal: '500000.00',
            iptu_valor_total: '1234.56',
            numero_cadastro: '123.456.0001-2',
            exercicio: 2026,
          },
        ],
      }),
    );

    const adapter = new InfoSimplesAdapter({
      apiToken: 'tok',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const record = await adapter.getIptu(address, 2026);
    expect(record).not.toBeNull();
    expect(record?.source).toBe('infosimples');
    expect(record?.assessedValue).toBe(500_000);
    expect(record?.iptuAmount).toBeCloseTo(1234.56);
    expect(record?.cadastralNumber).toBe('123.456.0001-2');
    expect(record?.taxYear).toBe(2026);
    expect(record?.fetchedAt).toBeInstanceOf(Date);
  });

  it('retorna null em 429 sem lançar', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('', { status: 429 }));
    const logger = makeLogger();
    const adapter = new InfoSimplesAdapter({
      apiToken: 'tok',
      fetchFn: fetchFn as unknown as typeof fetch,
      logger,
    });

    const record = await adapter.getIptu(address, 2026);
    expect(record).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('retorna null em timeout', async () => {
    const fetchFn = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );

    const logger = makeLogger();
    const adapter = new InfoSimplesAdapter({
      apiToken: 'tok',
      fetchFn: fetchFn as unknown as typeof fetch,
      timeoutMs: 10,
      logger,
    });

    const record = await adapter.getIptu(address, 2026);
    expect(record).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('timeout'),
      expect.any(Object),
    );
  });

  it('retorna null e loga em JSON malformado', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response('{bad json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const logger = makeLogger();
    const adapter = new InfoSimplesAdapter({
      apiToken: 'tok',
      fetchFn: fetchFn as unknown as typeof fetch,
      logger,
    });

    const record = await adapter.getIptu(address, 2026);
    expect(record).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });
});
