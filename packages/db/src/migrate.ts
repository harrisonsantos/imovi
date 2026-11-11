/**
 * Aplica as migrations SQL em ordem alfabética contra o DATABASE_URL atual.
 * Uso: `DATABASE_URL=... pnpm db:migrate`
 *
 * Executa os arquivos *.sql de `migrations/` (exceto *_pglite.sql, que são
 * usados só em testes). Cada arquivo e seu checksum são gravados na mesma
 * transação WebSocket. Uma migration já registrada não é executada novamente.
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@neondatabase/serverless';
import { checksumMatches, migrationChecksum } from './migration-checksum.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

export interface MigrationClient {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[] }>;
  exec?(text: string): Promise<unknown>;
}

export interface RunMigrationsOptions {
  migrationsDir?: string;
  pglite?: boolean;
  logger?: Pick<Console, 'log'>;
}

export interface RunMigrationsResult {
  applied: string[];
  skipped: string[];
}

function formatMigrationError(file: string, err: unknown): Error & { code?: string } {
  const message = err instanceof Error ? err.message : String(err);
  const sqlState =
    typeof (err as { code?: unknown })?.code === 'string'
      ? (err as { code: string }).code
      : undefined;
  const codeSuffix = sqlState && !message.includes(sqlState) ? ` (SQLSTATE ${sqlState})` : '';
  const wrapped = new Error(`Migration failed for ${file}: ${message}${codeSuffix}`, {
    cause: err,
  }) as Error & { code?: string };
  if (sqlState) {
    wrapped.code = sqlState;
  }
  return wrapped;
}

export async function runMigrations(
  client: MigrationClient,
  options: RunMigrationsOptions = {},
): Promise<RunMigrationsResult> {
  const migrationsDir = options.migrationsDir ?? MIGRATIONS_DIR;
  const usePglite = options.pglite ?? typeof client.exec === 'function';
  const logger = options.logger ?? console;

  const allFiles = await readdir(migrationsDir);
  const files = allFiles.filter((f) => f.endsWith('.sql') && !f.includes('_pglite')).sort();
  const applied: string[] = [];
  const skipped: string[] = [];

  await client.query("SELECT pg_advisory_lock(hashtext('imovi_schema_migrations'))");
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    for (const file of files) {
      const content = await readFile(join(migrationsDir, file), 'utf8');
      const checksum = migrationChecksum(content);
      const previous = await client.query<{ checksum: string }>(
        'SELECT checksum FROM schema_migrations WHERE name = $1',
        [file],
      );
      if (previous.rows.length > 0) {
        if (!checksumMatches(previous.rows[0]!.checksum, content))
          throw new Error(`Migration checksum mismatch: ${file}`);
        logger.log(`[db:migrate] já aplicada ${file}`);
        skipped.push(file);
        continue;
      }

      const pgliteFile = file.replace(/\.sql$/, '_pglite.sql');
      const sqlToExecute =
        usePglite && allFiles.includes(pgliteFile)
          ? await readFile(join(migrationsDir, pgliteFile), 'utf8')
          : content;

      logger.log(`[db:migrate] aplicando ${file}`);
      await client.query('BEGIN');
      try {
        if (typeof client.exec === 'function') {
          await client.exec(sqlToExecute);
        } else {
          await client.query(sqlToExecute);
        }
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
          file,
          checksum,
        ]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw formatMigrationError(file, err);
      }
    }
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext('imovi_schema_migrations'))")
      .catch(() => undefined);
  }

  return { applied, skipped };
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('db:migrate: DATABASE_URL não definida.');
    process.exit(1);
  }

  // Client WebSocket (não o HTTP tagged-template): aceita SQL multi-statement,
  // necessário para arquivos de migration com vários CREATE.
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await runMigrations(client, { pglite: false });
  } finally {
    await client.end();
  }
  console.log('[db:migrate] ok');
}

const isDirectRun =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((err: unknown) => {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(
      `db:migrate: falha; nenhuma migration incompleta foi registrada (${detail}). Verifique schema, backup e conexão no ambiente autorizado.`,
    );
    process.exit(1);
  });
}
