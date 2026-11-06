import { describe, expect, it, vi } from 'vitest';
import * as enrichment from '../src/index.js';

const key = { cep: '80000-000', number: '10', taxYear: 2026 };
const record = {
  ...key,
  source: 'infosimples' as const,
  assessedValue: 1000,
  iptuAmount: 100,
  areaM2: 80,
  cadastralNumber: '000',
  fetchedAt: new Date(),
  rawPayload: { proprietario: 'PESSOA SINTETICA', cpf: 'CPF-SINTETICO' },
};

describe('cache IPTU', () => {
  it('exporta cache em memória e KV', () => {
    expect(enrichment).toHaveProperty('MemoryIptuCache');
    expect(enrichment).toHaveProperty('KvIptuCache');
  });

  it('cache em memória isola ano/número e expira após 365 dias', async () => {
    const cache = new enrichment.MemoryIptuCache();
    expect(await cache.getFresh(key)).toBeNull();
    await cache.put(record);
    expect(await cache.getFresh(key)).toMatchObject({ areaM2: 80, fetchedAt: record.fetchedAt });
    expect(await cache.getFresh({ ...key, taxYear: 2025 })).toBeNull();
    expect(await cache.getFresh({ ...key, number: '11' })).toBeNull();
    await cache.put({ ...record, fetchedAt: new Date(Date.now() - 366 * 86400000) });
    expect(await cache.getFresh(key)).toBeNull();
  });

  it('KV serializa Date com TTL e projeção fiscal sem PII', async () => {
    const store = new Map<string, string>();
    const kv = {
      get: vi.fn(async (k: string) => store.get(k) ?? null),
      put: vi.fn(async (k: string, v: string, _opts: { expirationTtl: number }) => {
        store.set(k, v);
      }),
    };
    const cache = new enrichment.KvIptuCache(kv);
    await cache.put(record);
    const saved = await cache.getFresh(key);
    expect(saved?.fetchedAt).toEqual(record.fetchedAt);
    expect(saved?.areaM2).toBe(80);
    expect(kv.put).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
      expirationTtl: 365 * 86400,
    });
    expect([...store.values()].join()).not.toMatch(/PESSOA|CPF|proprietario/);
  });

  it.each([
    '{bad',
    '{}',
    JSON.stringify({ ...record, taxYear: 2025 }),
    JSON.stringify({ ...record, fetchedAt: '2020-01-01' }),
  ])('KV inválido/stale é miss: %s', async (value) => {
    const cache = new enrichment.KvIptuCache({ get: async () => value, put: vi.fn() });
    expect(await cache.getFresh(key)).toBeNull();
  });
});
