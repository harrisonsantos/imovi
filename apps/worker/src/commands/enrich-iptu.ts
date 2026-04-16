import { createDbClient, iptuRepo } from '@imovi/db';
import { fetchIptu } from '@imovi/enrichment';

import type { Logger } from '../logger.js';
import { runEnrichIptu, type Property, type IptuRecord } from '../pipeline/run-enrich.js';

export interface EnrichIptuCommandOpts {
  limit?: number;
  databaseUrl: string;
  logger: Logger;
}

/**
 * Wire real do enrichment IPTU.
 *
 * TODO(fase-5): `listPropertiesWithoutFreshIptu` ainda não existe no
 * @imovi/db — expor um repo-method dedicado quando o scheduler estiver no ar.
 * Por enquanto este command é um stub que loga "não implementado" de forma
 * explícita para o operador humano.
 */
export async function runEnrichIptuCommand(
  opts: EnrichIptuCommandOpts,
): Promise<void> {
  const db = createDbClient({ connectionString: opts.databaseUrl });

  const listProperties: (db: unknown, o: { limit?: number }) => Promise<Property[]> =
    async () => {
      opts.logger.warn('list_properties_fn_missing', {
        hint: 'Implementar propertyRepo.listWithoutFreshIptu em @imovi/db',
      });
      return [];
    };

  const persistIptu: (db: unknown, record: IptuRecord) => Promise<void> = async (
    _db,
    _record,
  ) => {
    // iptuRepo existe mas o contrato `upsert(record)` ainda não está fechado.
    // Deixar o log explícito evita engolir chamadas silenciosamente.
    opts.logger.warn('iptu_persist_fn_missing', {
      hint: 'Definir iptuRepo.upsert em @imovi/db com shape final',
    });
    void iptuRepo;
  };

  const fetchIptuAdapter = ({ property }: { property: Property }): Promise<IptuRecord | null> =>
    (fetchIptu as unknown as (args: unknown) => Promise<IptuRecord | null>)({
      property,
      cache: undefined,
      adapters: undefined,
      logger: opts.logger,
    });

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
