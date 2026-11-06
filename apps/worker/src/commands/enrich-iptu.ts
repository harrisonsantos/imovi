/**
 * Wire real do enrichment IPTU.
 *
 * Adapters e cache injetados pela CLI/cron; sem consulta implícita ao env.
 */
import { createDbClient, propertyRepo, iptuRepo, type Property as DbProperty } from '@imovi/db';
import {
  fetchIptu,
  MemoryIptuCache,
  sanitizeIptuRecord,
  type IptuAdapter,
  type IptuCache,
  type IptuRecord,
} from '@imovi/enrichment';

import type { Logger } from '../logger.js';
import {
  runEnrichIptu,
  type Property,
  type IptuRecord as PipelineIptuRecord,
} from '../pipeline/run-enrich.js';

export interface EnrichIptuCommandOpts {
  limit?: number;
  databaseUrl: string;
  logger: Logger;
  /** Ano fiscal alvo. Default: ano corrente. */
  taxYear?: number;
  infoSimples?: IptuAdapter;
  curitiba?: IptuAdapter;
  cache?: IptuCache;
}

export async function runEnrichIptuCommand(opts: EnrichIptuCommandOpts): Promise<void> {
  const db = createDbClient({ connectionString: opts.databaseUrl });
  const taxYear = opts.taxYear ?? new Date().getUTCFullYear();

  const cache = opts.cache ?? new MemoryIptuCache();

  const listProperties = async (_db: unknown, o: { limit?: number }): Promise<Property[]> => {
    const rows = await propertyRepo.listWithoutFreshIptu(db, { limit: o.limit });
    return rows as unknown as Property[];
  };

  const fetchIptuAdapter = async ({
    property,
  }: {
    property: Property;
  }): Promise<PipelineIptuRecord | null> => {
    const p = property as unknown as DbProperty;
    // Campos mínimos: sem CEP ou sem cidade não há como consultar.
    if (!p.cep || !p.city || !p.state) {
      opts.logger.warn('enrich_iptu_address_incomplete', { propertyId: p.id });
      return null;
    }

    const record = await fetchIptu({
      address: {
        street: p.street ?? '',
        number: p.number ?? undefined,
        neighborhood: undefined,
        city: p.city,
        state: p.state,
        cep: p.cep,
      } as unknown as Parameters<typeof fetchIptu>[0]['address'],
      taxYear,
      cache,
      infoSimples: opts.infoSimples,
      curitiba: opts.curitiba,
      logger: opts.logger,
    });

    if (!record) return null;
    // Anexa propertyId ao registro pra persistência.
    return { ...(record as IptuRecord), propertyId: p.id } as unknown as PipelineIptuRecord;
  };

  const persistIptu = async (_db: unknown, record: PipelineIptuRecord): Promise<void> => {
    const r = sanitizeIptuRecord(record as unknown as IptuRecord);
    await iptuRepo.record(db, {
      propertyId: record.propertyId,
      source: r.source,
      taxYear: r.taxYear,
      assessedValue: r.assessedValue !== null ? String(r.assessedValue) : null,
      iptuAmount: r.iptuAmount !== null ? String(r.iptuAmount) : null,
      cadastralNumber: r.cadastralNumber ?? null,
      rawPayload: r.rawPayload ?? null,
      fetchedAt: r.fetchedAt,
    });
  };

  const result = await runEnrichIptu({
    db,
    listProperties,
    fetchIptu: fetchIptuAdapter,
    persistIptu,
    logger: opts.logger,
    limit: opts.limit,
  });

  opts.logger.info('enrich_iptu_command_result', { ...result });
  if (result.failed > 0) throw new Error(`enrich-iptu: ${result.failed} falha(s) no lote`);
}
