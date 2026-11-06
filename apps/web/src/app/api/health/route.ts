/**
 * GET /api/health — liveness + conectividade com Neon.
 *
 * Retorna 200 mesmo se DB falhar (healthcheck é informativo; app segue servindo
 * páginas estáticas). Se quisermos que CF marque o deploy como unhealthy,
 * mudar para 503 quando db='fail'.
 */
import { sql } from '@imovi/db/operators';
import { getCfEnv } from '@/lib/cf-env';
import { getDb } from '@/lib/db';


export async function GET(): Promise<Response> {
  const ts = new Date().toISOString();
  let dbStatus: 'ok' | 'fail' = 'fail';
  try {
    const env = await getCfEnv();
    const db = getDb(env.DATABASE_URL);
    await db.execute(sql`select 1`);
    dbStatus = 'ok';
  } catch (err) {
     
    console.error('[api/health] db ping falhou:', err);
  }
  return Response.json({ status: 'ok', ts, db: dbStatus });
}
