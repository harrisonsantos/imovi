/**
 * Monta o handler do better-auth em /api/auth/* (signup, login, logout,
 * sessões, organizations etc. — rotas geridas pela lib).
 */
import { apiError } from '@/lib/errors';
import { getCfEnv } from '@/lib/cf-env';
import { AuthConfigurationError, getAuth } from '@/lib/auth';


async function handler(req: Request): Promise<Response> {
  const cfEnv = await getCfEnv();
  try {
    return await getAuth(cfEnv).handler(req);
  } catch (err) {
    if (err instanceof AuthConfigurationError)
      return apiError(503, 'auth_unavailable', err.message);
    return apiError(503, 'auth_unavailable', 'Autenticação temporariamente indisponível.');
  }
}

export { handler as GET, handler as POST };
