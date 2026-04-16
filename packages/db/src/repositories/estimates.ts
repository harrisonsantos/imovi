/**
 * Repositório de estimativas de preço geradas pelo modelo.
 */
import { priceEstimates, type NewPriceEstimate, type PriceEstimate } from '../schema.js';
import type { AnyDbClient } from './types.js';

export interface EstimateRepo {
  record(db: AnyDbClient, row: NewPriceEstimate): Promise<PriceEstimate>;
}

export const estimateRepo: EstimateRepo = {
  async record(db, row) {
    const [inserted] = await db.insert(priceEstimates).values(row).returning();
    if (!inserted) throw new Error('estimateRepo.record: insert returned no row');
    return inserted;
  },
};
