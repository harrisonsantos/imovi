/**
 * Client Drizzle. Em produção usamos Neon serverless; em testes, pglite.
 *
 * `createDbClient` retorna o cliente para uso real (Neon).
 * Para testes, veja `tests/setup.ts` que expõe uma variante pglite-compatível.
 */
import { neon, Pool, type NeonQueryFunction } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzleTransactional } from 'drizzle-orm/neon-serverless';
import * as schema from './schema.js';

export type DbClient = NeonHttpDatabase<typeof schema>;

export interface CreateDbClientOptions {
  /** Connection string Postgres (ex.: DATABASE_URL do Neon). */
  connectionString: string;
}

/**
 * Cria um cliente Drizzle conectado a um Postgres Neon serverless.
 * Falha cedo com mensagem clara se connection string estiver vazia.
 */
export function createDbClient(options: CreateDbClientOptions): DbClient {
  const url = options.connectionString?.trim();
  if (!url) {
    throw new Error(
      'createDbClient: connectionString vazia. Defina DATABASE_URL antes de iniciar.',
    );
  }
  const sql: NeonQueryFunction<false, false> = neon(url);
  return drizzle(sql, { schema });
}

/** Conexão por requisição para callbacks transacionais; sempre chamar close no finally. */
export function createTransactionalDbClient(options: CreateDbClientOptions) {
  const url = options.connectionString?.trim();
  if (!url) throw new Error('createTransactionalDbClient: connectionString vazia.');
  const pool = new Pool({ connectionString: url });
  return { db: drizzleTransactional(pool, { schema }), close: () => pool.end() };
}
