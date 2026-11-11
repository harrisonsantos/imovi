import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Neon from '@neondatabase/serverless';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  end: vi.fn(),
  connect: vi.fn(),
}));
vi.mock('@neondatabase/serverless', async (importOriginal) => {
  const original = await importOriginal<typeof Neon>();
  return {
    ...original,
    Pool: class extends original.Pool {
      override connect = mocks.connect;
      override end = mocks.end;
    },
  };
});

import { createTransactionalDbClient } from '../src/client.js';
import { sql } from 'drizzle-orm';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release });
  mocks.query.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe('cliente transacional Neon', () => {
  it.each([false, true])(
    'executa callback, finaliza transação e libera conexão (falha=%s)',
    async (fail) => {
      const client = createTransactionalDbClient({
        connectionString: 'postgresql://user:pass@localhost/db',
      });
      const result = client.db.transaction(async (tx) => {
        await tx.execute(sql`select 1`);
        if (fail) throw new Error('forced failure');
        return 'ok';
      });
      if (fail) await expect(result).rejects.toThrow('forced failure');
      else await expect(result).resolves.toBe('ok');
      const statements = mocks.query.mock.calls.map(([query]) =>
        (typeof query === 'string' ? query : query.text).trim(),
      );
      expect(statements).toEqual(['begin', 'select 1', fail ? 'rollback' : 'commit']);
      expect(mocks.release).toHaveBeenCalledOnce();
      await client.close();
      expect(mocks.end).toHaveBeenCalledOnce();
    },
  );

  it('recusa configuração vazia', () => {
    expect(() => createTransactionalDbClient({ connectionString: ' ' })).toThrow(
      /connectionString vazia/,
    );
  });
});
