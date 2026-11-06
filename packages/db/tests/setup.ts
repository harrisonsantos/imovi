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
const MIGRATION_FILES = [
  '0001_initial_pglite.sql',
  '0002_cities_pglite.sql',
  '0003_auth_pglite.sql',
  '0004_audit_pglite.sql',
  '0005_matriculas_pglite.sql',
  '0006_billing_pglite.sql',
  '0007_stabilization_pglite.sql',
  '0008_terms_acceptance_pglite.sql',
];

export interface TestDb {
  db: AnyDbClient;
  raw: PGlite;
  dispose(): Promise<void>;
}

/**
 * Cria um banco pglite efêmero (em memória) com as tabelas aplicadas.
 * Use um handle por teste para isolamento total.
 */
export async function createTestDb(opts: { through?: number } = {}): Promise<TestDb> {
  const pg = new PGlite();
  await pg.waitReady;

  for (const file of MIGRATION_FILES.slice(0, opts.through)) {
    const sql = await readFile(join(__dirname, '..', 'migrations', file), 'utf8');
    // pglite aceita múltiplos statements via `.exec`.
    await pg.exec(sql);
  }

  const db = drizzle(pg, { schema }) as unknown as AnyDbClient;

  return {
    db,
    raw: pg,
    async dispose() {
      await pg.close();
    },
  };
}
