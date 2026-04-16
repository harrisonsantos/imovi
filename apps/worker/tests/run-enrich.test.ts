import { describe, it, expect, vi } from 'vitest';

import { runEnrichIptu, type Property, type IptuRecord } from '../src/pipeline/run-enrich.js';
import { silentLogger } from '../src/logger.js';

function prop(id: string): Property {
  return { id };
}

describe('runEnrichIptu', () => {
  it('processa lote até limit, contabiliza null como failed e sucesso persiste', async () => {
    const properties = [prop('p1'), prop('p2'), prop('p3'), prop('p4')];
    const persistIptu = vi.fn(async () => {});

    const result = await runEnrichIptu({
      db: {},
      listProperties: async (_db, opts) =>
        properties.slice(0, opts.limit ?? properties.length),
      fetchIptu: async ({ property }) => {
        if (property.id === 'p2') return null; // failed
        return { propertyId: property.id } as IptuRecord;
      },
      persistIptu,
      logger: silentLogger,
      limit: 3,
    });

    expect(result.processed).toBe(3);
    expect(result.enriched).toBe(2);
    expect(result.failed).toBe(1);
    expect(persistIptu).toHaveBeenCalledTimes(2);
  });

  it('exception em fetchIptu conta como failed sem derrubar o lote', async () => {
    const properties = [prop('p1'), prop('p2')];
    const persistIptu = vi.fn(async () => {});

    const result = await runEnrichIptu({
      db: {},
      listProperties: async () => properties,
      fetchIptu: async ({ property }) => {
        if (property.id === 'p1') throw new Error('timeout');
        return { propertyId: property.id } as IptuRecord;
      },
      persistIptu,
      logger: silentLogger,
    });

    expect(result.processed).toBe(2);
    expect(result.enriched).toBe(1);
    expect(result.failed).toBe(1);
    expect(persistIptu).toHaveBeenCalledOnce();
  });
});
