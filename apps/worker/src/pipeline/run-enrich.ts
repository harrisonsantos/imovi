import type { Logger } from '../logger.js';
import type { DbClient } from './run-scrape.js';

/**
 * Tipos estruturais locais. O shape concreto de Property/IptuRecord
 * vive em @imovi/db / @imovi/enrichment — aqui tratamos como opacos
 * para maximizar testabilidade.
 */
export type Property = { id: string } & Record<string, unknown>;
export type IptuRecord = { propertyId: string } & Record<string, unknown>;

export interface RunEnrichIptuDeps {
  db: DbClient;
  listProperties: (db: DbClient, opts: { limit?: number }) => Promise<Property[]>;
  fetchIptu: (args: { property: Property }) => Promise<IptuRecord | null>;
  persistIptu: (db: DbClient, record: IptuRecord) => Promise<void>;
  logger: Logger;
  limit?: number;
}

export interface RunEnrichIptuResult {
  processed: number;
  enriched: number;
  failed: number;
}

/**
 * Itera properties sem IPTU fresco e tenta enriquecer cada uma.
 * Falhas individuais (fetch null ou throw) são contadas como `failed`
 * e não interrompem o lote.
 */
export async function runEnrichIptu(
  deps: RunEnrichIptuDeps,
): Promise<RunEnrichIptuResult> {
  const { db, listProperties, fetchIptu, persistIptu, logger, limit } = deps;

  const result: RunEnrichIptuResult = {
    processed: 0,
    enriched: 0,
    failed: 0,
  };

  const properties = await listProperties(db, { limit });
  logger.info('enrich_iptu_start', { count: properties.length, limit });

  for (const property of properties) {
    result.processed += 1;
    try {
      const record = await fetchIptu({ property });
      if (record === null) {
        result.failed += 1;
        logger.warn('enrich_iptu_not_found', { propertyId: property.id });
        continue;
      }
      await persistIptu(db, record);
      result.enriched += 1;
    } catch (err) {
      result.failed += 1;
      logger.error('enrich_iptu_failed', {
        propertyId: property.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('enrich_iptu_done', { ...result });
  return result;
}
