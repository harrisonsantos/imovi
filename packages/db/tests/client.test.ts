import { describe, it, expect } from 'vitest';
import { createDbClient } from '../src/client.js';

describe('createDbClient', () => {
  it('retorna cliente drizzle quando recebe connection string válida', () => {
    const db = createDbClient({
      connectionString: 'postgresql://user:pass@host.neon.tech/db?sslmode=require',
    });
    expect(db).toBeDefined();
    expect(typeof db.select).toBe('function');
    expect(typeof db.insert).toBe('function');
  });

  it('lança erro claro quando connection string é vazia', () => {
    expect(() => createDbClient({ connectionString: '' })).toThrowError(/connectionString vazia/);
    expect(() => createDbClient({ connectionString: '   ' })).toThrowError(/connectionString vazia/);
  });
});
