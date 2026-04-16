/**
 * Repositório de registros IPTU.
 *
 * `getFresh(propertyId)` retorna o registro mais recente se fetched_at ocorreu
 * nos últimos 365 dias; caso contrário retorna null (dado estagnado).
 */
import { and, desc, eq, gte } from 'drizzle-orm';
import { iptuRecords, type IptuRecord, type NewIptuRecord } from '../schema.js';
import type { AnyDbClient } from './types.js';

const FRESHNESS_MS = 365 * 24 * 60 * 60 * 1000;

export interface IptuRepo {
  record(db: AnyDbClient, row: NewIptuRecord): Promise<IptuRecord>;
  getFresh(db: AnyDbClient, propertyId: string, now?: Date): Promise<IptuRecord | null>;
  recordError(
    db: AnyDbClient,
    row: { propertyId?: string | null; adapter: string; error: string },
  ): Promise<void>;
}

export const iptuRepo: IptuRepo = {
  async record(db, row) {
    const [inserted] = await db.insert(iptuRecords).values(row).returning();
    if (!inserted) throw new Error('iptuRepo.record: insert returned no row');
    return inserted;
  },

  async getFresh(db, propertyId, now = new Date()) {
    const cutoff = new Date(now.getTime() - FRESHNESS_MS);
    const rows = await db
      .select()
      .from(iptuRecords)
      .where(and(eq(iptuRecords.propertyId, propertyId), gte(iptuRecords.fetchedAt, cutoff)))
      .orderBy(desc(iptuRecords.fetchedAt))
      .limit(1);
    return rows[0] ?? null;
  },

  async recordError(db, row) {
    const { iptuFetchErrors } = await import('../schema.js');
    await db.insert(iptuFetchErrors).values({
      propertyId: row.propertyId ?? null,
      adapter: row.adapter,
      error: row.error,
    });
  },
};
