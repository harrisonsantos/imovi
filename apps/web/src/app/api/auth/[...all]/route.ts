/**
 * Monta o handler do better-auth em /api/auth/* (signup, login, logout,
 * sessões, organizations etc. — rotas geridas pela lib).
 */
import { getAuth } from '@/lib/auth';

export const runtime = 'edge';

async function handler(req: Request): Promise<Response> {
  const { getRequestContext } = await import('@cloudflare/next-on-pages');
  let cfEnv: Record<string, string> = {};
  try {
    cfEnv = getRequestContext().env as Record<string, string>;
  } catch {
    // fora do runtime CF (dev puro/testes) — getAuth cai em process.env
  }
  const auth = getAuth({
    DATABASE_URL: cfEnv.DATABASE_URL,
    BETTER_AUTH_SECRET: cfEnv.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: cfEnv.BETTER_AUTH_URL,
  });
  return auth.handler(req);
}

export { handler as GET, handler as POST };
