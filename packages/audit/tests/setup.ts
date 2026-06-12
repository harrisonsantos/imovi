/**
 * Helper de testes: sobe um Postgres in-process via pglite (WASM),
 * aplica as MESMAS migrations *_pglite.sql de packages/db e devolve
 * um client Drizzle tipado.
 *
 * Cópia mínima do harness de packages/db/tests/setup.ts (não exportado
 * pelo pacote) — lê os arquivos de migration via caminho relativo.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@imovi/db/schema';
import type { AnyDbClient } from '@imovi/db';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'db', 'migrations');
const MIGRATION_FILES = [
  '0001_initial_pglite.sql',
  '0002_cities_pglite.sql',
  '0003_auth_pglite.sql',
  '0004_audit_pglite.sql',
  '0005_matriculas_pglite.sql',
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
export async function createTestDb(): Promise<TestDb> {
  const pg = new PGlite();
  await pg.waitReady;

  for (const file of MIGRATION_FILES) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
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
