/// <reference types="@cloudflare/workers-types" />

/**
 * Tipagem de variáveis de ambiente usadas pelo app web.
 *
 * - `DATABASE_URL`: conexão Neon Postgres (server-only).
 * - `TURNSTILE_SECRET`: secret key do Cloudflare Turnstile (server-only).
 * - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: site key público do Turnstile (exposto ao client).
 */
declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;
    TURNSTILE_SECRET?: string;
    NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
  }
}
