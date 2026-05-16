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
  let envKeys: string[] = [];
  let procEnvHasUrl = false;
  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages');
    const ctx = getRequestContext();
    const env = ctx.env as Record<string, unknown>;
    envKeys = Object.keys(env);
    const rawVal = env.DATABASE_URL;
    hasUrl = typeof rawVal === 'string' && rawVal.length > 0;
    procEnvHasUrl = typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.length > 0;
    const url = String(rawVal ?? '') || process.env.DATABASE_URL;
    if (!url) throw new Error(`DATABASE_URL tipo=${typeof rawVal} val=${JSON.stringify(rawVal)?.slice(0, 50)}`);
    const db = getDb(url);
    await db.execute(sql`select 1`);
    dbStatus = 'ok';
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[api/health] db ping falhou:', err);
  }
  return Response.json({ status: 'ok', ts, db: dbStatus, hasUrl, procEnvHasUrl, envKeys, dbError });
}
