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
    hasUrl = typeof env.DATABASE_URL === 'string' && (env.DATABASE_URL as string).length > 0;
    procEnvHasUrl = typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.length > 0;
    const url = (env.DATABASE_URL as string) || process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL não encontrada em env nem process.env');
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
