/**
 * Repositório de estimativas de preço geradas pelo modelo.
 */
import { priceEstimates, type NewPriceEstimate, type PriceEstimate } from '../schema.js';
import type { AnyDbClient } from './types.js';
import { eq } from 'drizzle-orm';

export interface EstimateRepo {
  record(db: AnyDbClient, row: NewPriceEstimate): Promise<PriceEstimate>;
  findById(db: AnyDbClient, id: string): Promise<PriceEstimate | null>;
}

export const estimateRepo: EstimateRepo = {
  async findById(db, id) {
    const [row] = await db.select().from(priceEstimates).where(eq(priceEstimates.id, id)).limit(1);
    return row ?? null;
  },
  async record(db, row) {
    const [inserted] = await db.insert(priceEstimates).values(row).returning();
    if (!inserted) throw new Error('estimateRepo.record: insert returned no row');
    return inserted;
  },
};
