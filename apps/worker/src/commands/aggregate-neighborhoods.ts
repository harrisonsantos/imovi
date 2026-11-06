import { createDbClient, neighborhoodRepo } from '@imovi/db';
import { rateLimitRepo } from '@imovi/db/rate-limit';
import type { Logger } from '../logger.js';

export async function runAggregateNeighborhoodsCommand(opts: {
  databaseUrl: string;
  logger: Logger;
}): Promise<{ updated: number; observed: number; insufficient: number }> {
  const db = createDbClient({ connectionString: opts.databaseUrl });
  const result = await neighborhoodRepo.aggregate(db);
  await rateLimitRepo.prune(db, new Date());
  opts.logger.info('neighborhood_aggregation_result', result);
  return result;
}
