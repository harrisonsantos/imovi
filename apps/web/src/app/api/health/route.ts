/**
 * GET /api/health — liveness + conectividade com Neon.
 *
 * Retorna 200 mesmo se DB falhar (healthcheck é informativo; app segue servindo
 * páginas estáticas). Se quisermos que CF marque o deploy como unhealthy,
 * mudar para 503 quando db='fail'.
 */
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';

export const runtime = 'edge';

export async function GET(): Promise<Response> {
  const ts = new Date().toISOString();
  let dbStatus: 'ok' | 'fail' = 'fail';
  let dbError: string | undefined;
  let hasUrl = false;
  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages');
    const env = getRequestContext().env as Record<string, string>;
    hasUrl = typeof env.DATABASE_URL === 'string' && env.DATABASE_URL.length > 0;
    const db = getDb(env.DATABASE_URL);
    await db.execute(sql`select 1`);
    dbStatus = 'ok';
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[api/health] db ping falhou:', err);
  }
  return Response.json({ status: 'ok', ts, db: dbStatus, hasUrl, dbError });
}
