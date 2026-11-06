/**
 * Acesso aos bindings do Worker OpenNext no contexto da requisição.
 * Fora do runtime CF (dev puro/testes) usa process.env.
 */
export async function getCfEnv(): Promise<Record<string, string>> {
  const runtimeEnv = process.env as Record<string, string>;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    return {
      ...runtimeEnv,
      ...(getCloudflareContext().env as unknown as Record<string, string>),
    };
  } catch {
    return runtimeEnv;
  }
}

export function isProductionEnv(
  env: { NODE_ENV?: string; NEXT_PUBLIC_APP_ENV?: string } = {},
): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    env.NODE_ENV === 'production' ||
    env.NEXT_PUBLIC_APP_ENV === 'production' ||
    env.NEXT_PUBLIC_APP_ENV === 'preview'
  );
}

/** Subset do env usado pelo requireOrg/sessionGuard nas rotas de auditoria. */
export function authEnvOf(cfEnv: Record<string, string>): {
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  NODE_ENV?: string;
  NEXT_PUBLIC_APP_ENV?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
} {
  return {
    DATABASE_URL: cfEnv.DATABASE_URL,
    BETTER_AUTH_SECRET: cfEnv.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: cfEnv.BETTER_AUTH_URL,
    NODE_ENV: cfEnv.NODE_ENV,
    NEXT_PUBLIC_APP_ENV: cfEnv.NEXT_PUBLIC_APP_ENV,
    RESEND_API_KEY: cfEnv.RESEND_API_KEY,
    EMAIL_FROM: cfEnv.EMAIL_FROM,
  };
}
