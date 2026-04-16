/**
 * Helper de testes: sobe um Postgres in-process via pglite (WASM),
 * aplica a migration *_pglite.sql e devolve um client Drizzle tipado.
 *
 * Cada teste tipicamente chama `createTestDb()` e depois `dispose()`.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/schema.js';
import type { AnyDbClient } from '../src/repositories/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_FILE = join(__dirname, '..', 'migrations', '0001_initial_pglite.sql');

export interface TestDb {
  db: AnyDbClient;
  raw: PGlite;
  dispose(): Promise<void>;
}

/**
 * Cria um banco pglite efêmero (em memória) com as tabelas aplicadas.
 * Use um handle por teste para isolamento total.
 */
export async function createTestDb(): Promise<TestDb> {
  const pg = new PGlite();
  await pg.waitReady;

  const sql = await readFile(MIGRATION_FILE, 'utf8');
  // pglite aceita múltiplos statements via `.exec`.
  await pg.exec(sql);

  const db = drizzle(pg, { schema }) as unknown as AnyDbClient;

  return {
    db,
    raw: pg,
    async dispose() {
      await pg.close();
    },
  };
}
