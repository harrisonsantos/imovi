import { sql } from '@imovi/db/operators';
import { getCfEnv } from '@/lib/cf-env';
import { getDb } from '@/lib/db';

export const runtime = 'edge';

/** Readiness is distinct from /api/health liveness; no secrets in response. */
export async function GET(): Promise<Response> {
  const env = await getCfEnv();
  const production =
    process.env.NODE_ENV === 'production' ||
    env.NODE_ENV === 'production' ||
    env.NEXT_PUBLIC_APP_ENV === 'production' ||
    env.NEXT_PUBLIC_APP_ENV === 'preview';
  const configured =
    Boolean(env.DATABASE_URL) &&
    (!production ||
      (Boolean(env.TURNSTILE_SECRET) &&
        (env.BETTER_AUTH_SECRET?.length ?? 0) >= 32 &&
        Boolean(env.RESEND_API_KEY) &&
        Boolean(env.EMAIL_FROM) &&
        Boolean(env.BETTER_AUTH_URL?.startsWith('https://'))));
  let database: 'ok' | 'fail' = 'fail';
  try {
    await getDb(env.DATABASE_URL).execute(sql`select 1`);
    database = 'ok';
  } catch {
    /* Deliberately omit connection strings and provider errors. */
  }
  const ready = configured && database === 'ok';
  return Response.json(
    {
      status: ready ? 'ready' : 'unavailable',
      checks: {
        database,
        configuration: configured ? 'ok' : 'fail',
      },
    },
    { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
