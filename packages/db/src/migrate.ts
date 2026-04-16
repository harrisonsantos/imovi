/**
 * Aplica as migrations SQL em ordem alfabética contra o DATABASE_URL atual.
 * Uso: `DATABASE_URL=... pnpm db:migrate`
 *
 * Executa os arquivos *.sql de `migrations/` (exceto *_pglite.sql, que são
 * usados só em testes). Cada arquivo é rodado como um único statement via
 * `neon.query` — idempotência é responsabilidade do SQL (CREATE IF NOT EXISTS).
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('db:migrate: DATABASE_URL não definida.');
    process.exit(1);
  }

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql') && !f.includes('_pglite'))
    .sort();

  const sql = neon(url);
  for (const file of files) {
    const content = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`[db:migrate] aplicando ${file}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sql as unknown as { query: (q: string) => Promise<unknown> }).query(content);
  }
  console.log('[db:migrate] ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
