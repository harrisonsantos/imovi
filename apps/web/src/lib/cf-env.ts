/**
 * Acesso ao env do Cloudflare Pages dentro das rotas edge.
 * Fora do runtime CF (dev puro/testes) retorna objeto vazio e os callers
 * caem em process.env.
 */
export async function getCfEnv(): Promise<Record<string, string>> {
  const { getRequestContext } = await import('@cloudflare/next-on-pages');
  try {
    return getRequestContext().env as Record<string, string>;
  } catch {
    return {};
  }
}

/** Subset do env usado pelo requireOrg/sessionGuard nas rotas de auditoria. */
export function authEnvOf(cfEnv: Record<string, string>): {
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
} {
  return {
    DATABASE_URL: cfEnv.DATABASE_URL,
    BETTER_AUTH_SECRET: cfEnv.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: cfEnv.BETTER_AUTH_URL,
  };
}
