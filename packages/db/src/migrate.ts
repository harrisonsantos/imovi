/**
 * Aplica as migrations SQL em ordem alfabética contra o DATABASE_URL atual.
 * Uso: `DATABASE_URL=... pnpm db:migrate`
 *
 * Executa os arquivos *.sql de `migrations/` (exceto *_pglite.sql, que são
 * usados só em testes). Cada arquivo e seu checksum são gravados na mesma
 * transação WebSocket. Uma migration já registrada não é executada novamente.
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

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

  // Client WebSocket (não o HTTP tagged-template): aceita SQL multi-statement,
  // necessário para arquivos de migration com vários CREATE.
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('imovi_schema_migrations'))");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    for (const file of files) {
      const content = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      const checksum = createHash('sha256').update(content).digest('hex');
      const previous = await client.query(
        'SELECT checksum FROM schema_migrations WHERE name = $1',
        [file],
      );
      if (previous.rows.length > 0) {
        if (previous.rows[0].checksum !== checksum)
          throw new Error(`Migration checksum mismatch: ${file}`);
        console.log(`[db:migrate] já aplicada ${file}`);
        continue;
      }
      console.log(`[db:migrate] aplicando ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(content);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
          file,
          checksum,
        ]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext('imovi_schema_migrations'))")
      .catch(() => undefined);
    await client.end();
  }
  console.log('[db:migrate] ok');
}

main().catch(() => {
  console.error(
    'db:migrate: falha; nenhuma migration incompleta foi registrada. Verifique schema, backup e conexão no ambiente autorizado.',
  );
  process.exit(1);
});
