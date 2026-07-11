/**
 * GET/PUT /api/auditoria/config — configuração Vista da organização ativa.
 *
 * Sessão obrigatória (requireOrg). A Vista API key é cifrada com AES-GCM
 * (VISTA_KEY_SECRET) antes de persistir e NUNCA retorna ao cliente — o GET
 * expõe apenas `hasApiKey`. No primeiro PUT geramos o webhookToken (32 bytes
 * hex) que compõe a URL pública do webhook.
 */
import { z } from 'zod';
import { orgVistaConfigRepo } from '@imovi/db/audit';
import type { OrgVistaConfig } from '@imovi/db/schema-audit';
import { encryptSecret } from '@imovi/audit/crypto';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';
import { requireOrg, sessionGuard } from '@/lib/session';

export const runtime = 'edge';

const ConfigPutSchema = z.object({
  vistaApiUrl: z.string().url().optional(),
  vistaApiKey: z.string().min(1).optional(),
  reportEmails: z.array(z.string().email()).max(20).optional(),
  avmDeviationPct: z.number().int().min(1).max(100).optional(),
});

async function getCfEnv(): Promise<Record<string, string>> {
  const { getRequestContext } = await import('@cloudflare/next-on-pages');
  try {
    return getRequestContext().env as Record<string, string>;
  } catch {
    // fora do runtime CF (dev puro/testes) — callers caem em process.env
    return {};
  }
}

/** Gera token de webhook: 32 bytes aleatórios em hex (64 chars). */
function generateWebhookToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Serialização segura da config — jamais inclui a key (nem cifrada). */
function toClientConfig(config: OrgVistaConfig | null, origin: string) {
  return {
    vistaApiUrl: config?.vistaApiUrl ?? null,
    hasApiKey: Boolean(config?.vistaApiKeyEnc),
    reportEmails: (config?.reportEmails as string[] | undefined) ?? [],
    avmDeviationPct: config?.avmDeviationPct ?? 25,
    webhookUrl: config
      ? `${origin}/api/auditoria/webhooks/vista/${config.webhookToken}`
      : null,
  };
}

export async function GET(req: Request): Promise<Response> {
  const cfEnv = await getCfEnv();
  let orgId: string;
  try {
    const session = await requireOrg(req, {
      DATABASE_URL: cfEnv.DATABASE_URL,
      BETTER_AUTH_SECRET: cfEnv.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: cfEnv.BETTER_AUTH_URL,
    });
    orgId = session.org.id;
  } catch (err) {
    return sessionGuard(err);
  }

  const db = getDb(cfEnv.DATABASE_URL);
  const config = await orgVistaConfigRepo.getByOrg(db, orgId);
  return Response.json(toClientConfig(config, new URL(req.url).origin));
}

export async function PUT(req: Request): Promise<Response> {
  const cfEnv = await getCfEnv();
  let orgId: string;
  try {
    const session = await requireOrg(req, {
      DATABASE_URL: cfEnv.DATABASE_URL,
      BETTER_AUTH_SECRET: cfEnv.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: cfEnv.BETTER_AUTH_URL,
    });
    orgId = session.org.id;
  } catch (err) {
    return sessionGuard(err);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Body deve ser JSON válido.');
  }
  const parsed = ConfigPutSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, 'invalid_request', 'Parâmetros inválidos.', parsed.error.flatten());
  }
  const body = parsed.data;

  const db = getDb(cfEnv.DATABASE_URL);
  const existing = await orgVistaConfigRepo.getByOrg(db, orgId);

  // Cifra a key apenas quando enviada; caso contrário preserva a existente.
  let vistaApiKeyEnc = existing?.vistaApiKeyEnc ?? null;
  if (body.vistaApiKey !== undefined) {
    const keySecret = cfEnv.VISTA_KEY_SECRET ?? process.env.VISTA_KEY_SECRET;
    if (!keySecret) {
      console.error('[auditoria/config] VISTA_KEY_SECRET ausente no ambiente.');
      return apiError(503, 'config_unavailable', 'Cifragem de segredos indisponível.');
    }
    vistaApiKeyEnc = await encryptSecret(body.vistaApiKey, keySecret);
  }

  const updated = await orgVistaConfigRepo.upsert(db, orgId, {
    vistaApiUrl: body.vistaApiUrl ?? existing?.vistaApiUrl ?? null,
    vistaApiKeyEnc,
    // Primeiro PUT: gera o token de webhook; depois é imutável.
    webhookToken: existing?.webhookToken ?? generateWebhookToken(),
    reportEmails: body.reportEmails ?? (existing?.reportEmails as string[] | undefined) ?? [],
    avmDeviationPct: body.avmDeviationPct ?? existing?.avmDeviationPct ?? 25,
  });

  return Response.json(toClientConfig(updated, new URL(req.url).origin));
}
