/**
 * GET /api/health — liveness + conectividade com Neon.
 *
 * Retorna 200 mesmo se DB falhar (healthcheck é informativo; app segue servindo
 * páginas estáticas). Se quisermos que CF marque o deploy como unhealthy,
 * mudar para 503 quando db='fail'.
 */
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { getCfEnv } from '@/lib/cf-env';

export const runtime = 'edge';

export async function GET(): Promise<Response> {
  const ts = new Date().toISOString();
  let dbStatus: 'ok' | 'fail' = 'fail';
  try {
    const cfEnv = await getCfEnv();
    const db = getDb(cfEnv.DATABASE_URL);
    await db.execute(sql`select 1`);
    dbStatus = 'ok';
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/health] db ping falhou:', err);
  }
  return Response.json({ status: 'ok', ts, db: dbStatus });
}
