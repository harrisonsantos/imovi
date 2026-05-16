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

  // Diagnóstico temporário — quais env vars estão disponíveis
  const envKeys: string[] = [];
  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages');
    const cfEnv = getRequestContext().env as Record<string, unknown>;
    envKeys.push(...Object.keys(cfEnv).sort());
  } catch {
    envKeys.push('__getRequestContext_unavailable__');
  }

  const hasProcessEnv = typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.length > 0;

  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    dbStatus = 'ok';
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/health] db ping falhou:', err);
    dbError = err instanceof Error ? err.message : String(err);
  }
  return Response.json({
    status: 'ok', ts, db: dbStatus,
    ...(dbError ? { dbError } : {}),
    _diag: { envKeys, hasProcessEnv },
  });
}
