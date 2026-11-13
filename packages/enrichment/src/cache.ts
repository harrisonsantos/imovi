import { IptuRecordSchema, type IptuRecord } from './types.js';

/**
 * Interface abstrata de cache/persistência de IPTU.
 * O caller (CLI, worker, etc.) injeta uma implementação concreta
 * (ex.: adapter em cima de @imovi/db quando estiver pronto).
 * Isso mantém o módulo enrichment testável sem acoplar a um banco.
 */
export interface IptuCache {
  /**
   * Retorna um registro de IPTU "fresco" (tipicamente fetchedAt < 365 dias)
   * para a chave composta por CEP + número do imóvel + ano fiscal.
   * Retorna null se não houver hit ou se estiver stale.
   */
  getFresh(key: { cep: string; number?: string; taxYear: number }): Promise<IptuRecord | null>;

  /** Persiste um registro no cache, indexado por CEP + número. */
  put(record: IptuRecord & { cep: string; number?: string }): Promise<void>;
}

type CacheKey = Parameters<IptuCache['getFresh']>[0];
const FRESHNESS_SECONDS = 365 * 24 * 60 * 60;

/** Projeção permitida também protege leitores de entradas antigas de cache. */
export function sanitizeIptuRecord(record: IptuRecord): IptuRecord {
  const { source, taxYear, assessedValue, iptuAmount, cadastralNumber, areaM2, fetchedAt } = record;
  const fiscal = { taxYear, assessedValue, iptuAmount, cadastralNumber, areaM2 };
  return { source, ...fiscal, fetchedAt, rawPayload: fiscal };
}

function cacheKey(key: CacheKey): string {
  return `iptu:v1:${JSON.stringify([key.cep, key.number ?? '', key.taxYear])}`;
}

function readFresh(value: string | null, key: CacheKey): IptuRecord | null {
  if (!value) return null;
  try {
    const raw = JSON.parse(value) as Record<string, unknown>;
    const parsed = IptuRecordSchema.safeParse({
      ...raw,
      fetchedAt: new Date(String(raw.fetchedAt)),
    });
    if (!parsed.success || parsed.data.taxYear !== key.taxYear) return null;
    const age = Date.now() - parsed.data.fetchedAt.getTime();
    if (age < 0 || age >= FRESHNESS_SECONDS * 1000) return null;
    return sanitizeIptuRecord(parsed.data);
  } catch {
    return null;
  }
}

/** Cache por execução da CLI; não substitui persistência no banco. */
export class MemoryIptuCache implements IptuCache {
  private readonly records = new Map<string, string>();

  async getFresh(key: CacheKey): Promise<IptuRecord | null> {
    return readFresh(this.records.get(cacheKey(key)) ?? null, key);
  }

  async put(record: IptuRecord & { cep: string; number?: string }): Promise<void> {
    this.records.set(cacheKey(record), JSON.stringify(sanitizeIptuRecord(record)));
  }
}

/** Interface estrutural compatível com o binding Cloudflare IPTU_CACHE. */
export interface IptuKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options: { expirationTtl: number }): Promise<unknown>;
}

export class KvIptuCache implements IptuCache {
  constructor(private readonly kv: IptuKv) {}

  async getFresh(key: CacheKey): Promise<IptuRecord | null> {
    return readFresh(await this.kv.get(cacheKey(key)), key);
  }

  async put(record: IptuRecord & { cep: string; number?: string }): Promise<void> {
    await this.kv.put(cacheKey(record), JSON.stringify(sanitizeIptuRecord(record)), {
      expirationTtl: FRESHNESS_SECONDS,
    });
  }
}
