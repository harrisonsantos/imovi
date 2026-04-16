import { describe, it, expect, vi } from 'vitest';
import type { NormalizedAddress } from '@imovi/shared';
import { fetchIptu } from '../src/fetch-iptu.js';
import type { IptuCache } from '../src/cache.js';
import type { IptuRecord } from '../src/types.js';
import type { Logger } from '../src/logger.js';

const address: NormalizedAddress = {
  street: 'Rua Exemplo',
  number: '123',
  neighborhood: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  cep: '01310-100',
};

function makeRecord(partial: Partial<IptuRecord> = {}): IptuRecord {
  return {
    source: 'infosimples',
    taxYear: 2026,
    assessedValue: 500_000,
    iptuAmount: 1234.56,
    rawPayload: { ok: true },
    fetchedAt: new Date(),
    ...partial,
  };
}

function makeCache(): IptuCache & {
  getFresh: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
} {
  return {
    getFresh: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
  };
}

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

describe('fetchIptu', () => {
  it('usa cache.getFresh e NÃO chama adapter em hit', async () => {
    const cached = makeRecord();
    const cache = makeCache();
    cache.getFresh.mockResolvedValueOnce(cached);
    const adapter = { getIptu: vi.fn() };

    const result = await fetchIptu({
      address,
      taxYear: 2026,
      cache,
      infoSimples: adapter,
    });

    expect(result).toBe(cached);
    expect(adapter.getIptu).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('chama adapter e salva em cache.put quando adapter retorna IptuRecord', async () => {
    const cache = makeCache();
    const record = makeRecord();
    const adapter = { getIptu: vi.fn().mockResolvedValue(record) };

    const result = await fetchIptu({
      address,
      taxYear: 2026,
      cache,
      infoSimples: adapter,
    });

    expect(result).toEqual(record);
    expect(adapter.getIptu).toHaveBeenCalledWith(address, 2026);
    expect(cache.put).toHaveBeenCalledWith(
      expect.objectContaining({
        ...record,
        cep: address.cep,
        number: address.number,
      }),
    );
  });

  it('retorna null e loga warn para cidade não-suportada, sem chamar adapter', async () => {
    const cache = makeCache();
    const adapter = { getIptu: vi.fn() };
    const logger = makeLogger();

    const result = await fetchIptu({
      address: {
        ...address,
        city: 'Curitiba',
        state: 'PR',
        cep: '80000-000',
      },
      taxYear: 2026,
      cache,
      infoSimples: adapter,
      logger,
    });

    expect(result).toBeNull();
    expect(adapter.getIptu).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('retorna null sem lançar quando adapter retorna null', async () => {
    const cache = makeCache();
    const adapter = { getIptu: vi.fn().mockResolvedValue(null) };

    const result = await fetchIptu({
      address,
      taxYear: 2026,
      cache,
      infoSimples: adapter,
    });

    expect(result).toBeNull();
    expect(cache.put).not.toHaveBeenCalled();
  });
});
