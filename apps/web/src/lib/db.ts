// Subpath evita puxar repositories/properties (que usa node:crypto via shared)
// pro bundle edge.
import { createDbClient, type DbClient } from '@imovi/db/client';

let cached: DbClient | null = null;

/**
 * @param cfEnvUrl - DATABASE_URL lido por getRequestContext().env no caller.
 * Necessário porque o polyfill de process.env do @cloudflare/next-on-pages
 * não injeta secrets e o import estático de getRequestContext pode resolver
 * para uma instância diferente da que o runtime popula.
 */
export function getDb(cfEnvUrl?: string): DbClient {
  if (cached) return cached;
  const url = cfEnvUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL não configurada no ambiente do worker.');
  }
  cached = createDbClient({ connectionString: url });
  return cached;
}
