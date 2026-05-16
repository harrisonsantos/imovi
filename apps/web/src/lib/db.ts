// Subpath evita puxar repositories/properties (que usa node:crypto via shared)
// pro bundle edge.
import { createDbClient, type DbClient } from '@imovi/db/client';
import { getRequestContext } from '@cloudflare/next-on-pages';

let cached: DbClient | null = null;

export function getDb(): DbClient {
  if (cached) return cached;
  let url: string | undefined = process.env.DATABASE_URL;
  if (!url) {
    try {
      url = (getRequestContext().env as Record<string, string>).DATABASE_URL;
    } catch {
      // dev local sem CF runtime — ignora
    }
  }
  if (!url) {
    throw new Error('DATABASE_URL não configurada no ambiente do worker.');
  }
  cached = createDbClient({ connectionString: url });
  return cached;
}
