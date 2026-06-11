/**
 * Backfill one-shot de properties.neighborhood_id.
 *
 * Percorre properties com neighborhood_id NULL, extrai o bairro do
 * address_raw via matcher e seta o id correspondente. Idempotente:
 * re-rodar não altera rows já preenchidas.
 */
import { createDbClient, neighborhoodRepo, propertyRepo } from '@imovi/db';
import { matchNeighborhood, type NeighborhoodCandidate } from '@imovi/normalizer';

import type { Logger } from '../logger.js';

export interface BackfillNeighborhoodsOpts {
  databaseUrl: string;
  logger: Logger;
  /** Cidade alvo. Default: Curitiba/PR. */
  city?: string;
  state?: string;
}

export interface BackfillNeighborhoodsResult {
  scanned: number;
  matched: number;
  unmatched: number;
}

export async function runBackfillNeighborhoodsCommand(
  opts: BackfillNeighborhoodsOpts,
): Promise<BackfillNeighborhoodsResult> {
  const db = createDbClient({ connectionString: opts.databaseUrl });
  const city = opts.city ?? 'Curitiba';
  const state = opts.state ?? 'PR';

  const candidates: NeighborhoodCandidate[] = await neighborhoodRepo.listByCity(
    db,
    city,
    state,
  );
  if (candidates.length === 0) {
    opts.logger.warn('backfill_no_neighborhoods', { city, state });
    return { scanned: 0, matched: 0, unmatched: 0 };
  }

  const rows = await propertyRepo.listWithoutNeighborhood(db, city, state);

  const result: BackfillNeighborhoodsResult = {
    scanned: rows.length,
    matched: 0,
    unmatched: 0,
  };

  for (const row of rows) {
    const neighborhoodId = row.addressRaw
      ? matchNeighborhood(row.addressRaw, city, candidates)
      : undefined;
    if (!neighborhoodId) {
      result.unmatched += 1;
      continue;
    }
    await propertyRepo.setNeighborhoodId(db, row.id, neighborhoodId);
    result.matched += 1;
  }

  opts.logger.info('backfill_neighborhoods_done', { ...result, city, state });
  return result;
}
