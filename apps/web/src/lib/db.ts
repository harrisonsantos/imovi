/**
 * Helper singleton para criar o cliente Drizzle nos endpoints edge.
 *
 * Em Cloudflare Pages edge runtime, `process.env.DATABASE_URL` é injetado
 * a partir do binding configurado no dashboard.
 */
// Subpath evita puxar repositories/properties (que usa node:crypto via shared)
// pro bundle edge.
import { createDbClient, type DbClient } from '@imovi/db/client';

let cached: DbClient | null = null;

export function getDb(): DbClient {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL não configurada no ambiente do worker.');
  }
  cached = createDbClient({ connectionString: url });
  return cached;
}
