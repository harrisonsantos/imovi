import type { NormalizedAddress } from '@imovi/shared';
import type { IptuRecord } from './types.js';
import type { IptuCache } from './cache.js';
import { noopLogger, type Logger } from './logger.js';
import type { InfoSimplesAdapter } from './adapters/infosimples.js';

/** Adapter abstrato — qualquer coisa com `getIptu(address, taxYear)`. */
export interface IptuAdapter {
  getIptu(address: NormalizedAddress, taxYear: number): Promise<IptuRecord | null>;
}

export interface FetchIptuOptions {
  address: NormalizedAddress;
  taxYear: number;
  cache: IptuCache;
  /**
   * Adapter InfoSimples de SP/capital. Sem adapter, somente cache.
   */
  infoSimples?: InfoSimplesAdapter | IptuAdapter;
  curitiba?: IptuAdapter;
  logger?: Logger;
}

/**
 * Fluxo:
 *   1. Consulta cache (`getFresh`) — se hit, retorna sem chamar adapter.
 *   2. Seleciona adapter pela cidade/UF:
 *        - São Paulo / SP -> InfoSimples
 *        - Curitiba / PR -> adapter Curitiba
 *        - outras        -> cobertura inexistente + null
 *   3. Em sucesso, grava no cache e retorna.
 *   4. Em falha do adapter, retorna null; nunca lança.
 */
export async function fetchIptu(opts: FetchIptuOptions): Promise<IptuRecord | null> {
  const { address, taxYear, cache } = opts;
  const logger = opts.logger ?? noopLogger;

  const cached = await cache.getFresh({
    cep: address.cep,
    number: address.number,
    taxYear,
  });
  if (cached) {
    return cached;
  }

  const adapter = selectAdapter(opts);
  if (!adapter) {
    logger.warn('fetchIptu: cobertura inexistente', {
      city: address.city,
      state: address.state,
    });
    return null;
  }

  let record: IptuRecord | null;
  try {
    record = await adapter.getIptu(address, taxYear);
  } catch (err) {
    logger.error('fetchIptu: adapter lançou erro inesperado', {
      error: (err as Error).message,
    });
    return null;
  }

  if (!record) {
    return null;
  }

  await cache.put({ ...record, cep: address.cep, number: address.number });
  return record;
}

/** Seleciona adapter com base em cidade/UF. */
function selectAdapter(opts: FetchIptuOptions): IptuAdapter | null {
  const { address, infoSimples } = opts;
  if (address.state === 'PR' && normalizeCity(address.city) === 'curitiba') {
    return opts.curitiba ?? null;
  }
  const isSpCapital =
    address.state === 'SP' && normalizeCity(address.city) === 'sao paulo' && !!infoSimples;
  if (isSpCapital && infoSimples) {
    return infoSimples;
  }
  return null;
}

function normalizeCity(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
