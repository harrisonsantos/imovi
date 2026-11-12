/**
 * Repositório de estimativas de preço geradas pelo modelo.
 */
import { priceEstimates, type NewPriceEstimate, type PriceEstimate } from '../schema.js';
import type { AnyDbClient } from './types.js';
import { desc, eq } from 'drizzle-orm';

export interface EstimateRepo {
  record(db: AnyDbClient, row: NewPriceEstimate): Promise<PriceEstimate>;
  findById(db: AnyDbClient, id: string): Promise<PriceEstimate | null>;
  listByOwnerUserId(
    db: AnyDbClient,
    userId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<PriceEstimate[]>;
}

export const estimateRepo: EstimateRepo = {
  async listByOwnerUserId(db, userId, opts = {}) {
    const limit = Math.min(100, Math.max(1, Math.trunc(opts.limit ?? 50)));
    const offset = Math.max(0, Math.trunc(opts.offset ?? 0));
    if (!Number.isFinite(limit) || !Number.isFinite(offset)) throw new Error('Invalid pagination');
    return db
      .select()
      .from(priceEstimates)
      .where(eq(priceEstimates.ownerUserId, userId))
      .orderBy(desc(priceEstimates.createdAt), desc(priceEstimates.id))
      .limit(limit)
      .offset(offset);
  },
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
