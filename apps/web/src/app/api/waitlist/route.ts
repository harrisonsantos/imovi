import { z } from 'zod';
import { waitlistRepo } from '@imovi/db/waitlist';
import { getCfEnv } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';
import {
  clientIp,
  consumeEstimateLimit,
  requiresProductionProtection,
} from '@/lib/estimate-protection';

export const runtime = 'edge';
const Schema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  consent: z.literal(true),
});

export async function POST(req: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Envie dados válidos.');
  }
  const parsed = Schema.safeParse(json);
  if (!parsed.success)
    return apiError(400, 'invalid_request', 'Informe um e-mail válido e aceite receber novidades.');
  try {
    const env = await getCfEnv();
    const ip = clientIp(req, requiresProductionProtection(env));
    if (!ip) return apiError(503, 'protection_unavailable', 'Serviço indisponível.');
    const db = getDb(env.DATABASE_URL);
    const rate = await consumeEstimateLimit(db, ip, 5, Date.now(), 'waitlist');
    if (!rate.allowed)
      return Response.json(
        { error: 'rate_limited', message: 'Tente novamente em um minuto.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      );
    await waitlistRepo.register(db, {
      email: parsed.data.email,
      source: 'precos',
      consentVersion: 'waitlist-updates-v1',
    });
    return Response.json({ registered: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return apiError(
      503,
      'waitlist_unavailable',
      'Não foi possível salvar seu contato. Tente novamente.',
    );
  }
}
