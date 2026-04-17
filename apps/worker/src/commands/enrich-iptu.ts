/**
 * Wire real do enrichment IPTU.
 *
 * MVP Curitiba: não existe adapter de IPTU público/automatizado para Curitiba
 * (InfoSimples só cobre SP/capital). A infra está pronta:
 *   - `listWithoutFreshIptu` lista properties candidatas
 *   - `fetchIptu` roteia por cidade; retorna null para Curitiba com log explícito
 *   - `iptuRepo.record` persiste quando um adapter for implementado
 *
 * Quando um adapter Curitiba for criado (ex.: scraper do portal da PMC),
 * basta injetá-lo em `fetchIptuAdapter.adapters` aqui.
 */
import { createDbClient, propertyRepo, iptuRepo, type Property as DbProperty } from '@imovi/db';
import { fetchIptu, type IptuCache, type IptuRecord } from '@imovi/enrichment';

import type { Logger } from '../logger.js';
import { runEnrichIptu, type Property, type IptuRecord as PipelineIptuRecord } from '../pipeline/run-enrich.js';

export interface EnrichIptuCommandOpts {
  limit?: number;
  databaseUrl: string;
  logger: Logger;
  /** Ano fiscal alvo. Default: ano corrente. */
  taxYear?: number;
}

/**
 * No-op cache: sempre miss, descarta puts. Útil enquanto não temos uma
 * camada de cache dedicada (ex.: KV IPTU_CACHE) wireada.
 */
const noopCache: IptuCache = {
  async getFresh() {
    return null;
  },
  async put() {
    // descarta
  },
};

export async function runEnrichIptuCommand(
  opts: EnrichIptuCommandOpts,
): Promise<void> {
  const db = createDbClient({ connectionString: opts.databaseUrl });
  const taxYear = opts.taxYear ?? new Date().getUTCFullYear();

  // Flag para logar "adapter ausente" só 1x por run pra evitar spam em lote.
  let warnedCuritibaMissing = false;

  const listProperties = async (
    _db: unknown,
    o: { limit?: number },
  ): Promise<Property[]> => {
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

    if (p.city === 'Curitiba' && p.state === 'PR' && !warnedCuritibaMissing) {
      warnedCuritibaMissing = true;
      opts.logger.warn('curitiba_iptu_adapter_missing', {
        hint: 'InfoSimples não cobre Curitiba. Adapter específico pendente.',
      });
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
      cache: noopCache,
      infoSimples: undefined,
      logger: opts.logger,
    });

    if (!record) return null;
    // Anexa propertyId ao registro pra persistência.
    return { ...(record as IptuRecord), propertyId: p.id } as unknown as PipelineIptuRecord;
  };

  const persistIptu = async (
    _db: unknown,
    record: PipelineIptuRecord,
  ): Promise<void> => {
    const r = record as unknown as IptuRecord & { propertyId: string };
    await iptuRepo.record(db, {
      propertyId: r.propertyId,
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
}
