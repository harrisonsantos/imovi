/**
 * Repositório de erros de scraping.
 */
import { desc, eq } from 'drizzle-orm';
import { scrapeErrors, type NewScrapeError, type ScrapeError } from '../schema.js';
import type { AnyDbClient } from './types.js';

export interface ScrapeErrorRepo {
  record(db: AnyDbClient, row: NewScrapeError): Promise<ScrapeError>;
  listBySource(db: AnyDbClient, source: string): Promise<ScrapeError[]>;
}

export const scrapeErrorRepo: ScrapeErrorRepo = {
  async record(db, row) {
    const [inserted] = await db.insert(scrapeErrors).values(row).returning();
    if (!inserted) throw new Error('scrapeErrorRepo.record: insert returned no row');
    return inserted;
  },

  async listBySource(db, source) {
    return await db
      .select()
      .from(scrapeErrors)
      .where(eq(scrapeErrors.source, source))
      .orderBy(desc(scrapeErrors.occurredAt));
  },
};
