import type { IptuRecord } from './types.js';

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
  getFresh(key: {
    cep: string;
    number?: string;
    taxYear: number;
  }): Promise<IptuRecord | null>;

  /** Persiste um registro no cache, indexado por CEP + número. */
  put(record: IptuRecord & { cep: string; number?: string }): Promise<void>;
}
