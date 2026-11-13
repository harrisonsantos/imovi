// Subpath evita puxar repositories/properties (que usa node:crypto via shared)
// pro bundle edge.
import { createDbClient, createTransactionalDbClient, type DbClient } from '@imovi/db/client';

let cached: { url: string; db: DbClient } | null = null;

/**
 * @param cfEnvUrl - DATABASE_URL dos bindings da requisição via getCfEnv().
 * Em testes e ferramentas Node, permite fallback para process.env.
 */
export function getDb(cfEnvUrl?: string): DbClient {
  const url = cfEnvUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL não configurada no ambiente do worker.');
  }
  if (!cached || cached.url !== url)
    cached = { url, db: createDbClient({ connectionString: url }) };
  return cached.db;
}

/** Pool restrito à requisição, sem cache entre invocações do worker. */
export function getTransactionalDb(cfEnvUrl?: string) {
  const url = cfEnvUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não configurada no ambiente do worker.');
  return createTransactionalDbClient({ connectionString: url });
}
