import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, type TestDb } from './setup.js';
import { scrapeErrorRepo } from '../src/repositories/scrape-errors.js';

describe('scrapeErrorRepo', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.dispose();
  });

  it('registra erro com timestamp e lista errors por source', async () => {
    const saved = await scrapeErrorRepo.record(t.db, {
      source: 'zap',
      url: 'https://www.zapimoveis.com.br/imovel/123',
      error: 'HTTP 500',
    });
    expect(saved.id).toBeDefined();
    expect(saved.occurredAt).toBeInstanceOf(Date);

    await scrapeErrorRepo.record(t.db, {
      source: 'vivareal',
      url: 'https://www.vivareal.com.br/imovel/999',
      error: 'timeout',
    });
    await scrapeErrorRepo.record(t.db, {
      source: 'zap',
      url: 'https://www.zapimoveis.com.br/imovel/124',
      error: 'parse error',
    });

    const zapErrors = await scrapeErrorRepo.listBySource(t.db, 'zap');
    expect(zapErrors).toHaveLength(2);
    for (const e of zapErrors) {
      expect(e.source).toBe('zap');
    }
  });
});
