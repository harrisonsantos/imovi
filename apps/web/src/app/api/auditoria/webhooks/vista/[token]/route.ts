/**
 * POST /api/auditoria/webhooks/vista/[token] — recebe eventos do Vista CRM.
 *
 * Endpoint público autenticado pelo token de webhook na URL: o token resolve
 * a organização dona via org_vista_config (token desconhecido → 404, sem
 * vazar existência). O payload validado é processado por processVistaEvent
 * (upserts multi-tenant + log em audit_eventos).
 */
import { vistaWebhookSchema } from '@imovi/audit/vista';
import { processVistaEvent } from '@imovi/audit/ingest';
import { orgVistaConfigRepo } from '@imovi/db/audit';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';

export const runtime = 'edge';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await ctx.params;

  const { getRequestContext } = await import('@cloudflare/next-on-pages');
  let cfEnv: Record<string, string> = {};
  try {
    cfEnv = getRequestContext().env as Record<string, string>;
  } catch {
    // fora do runtime CF (dev puro/testes) — getDb cai em process.env
  }

  let db;
  try {
    db = getDb(cfEnv.DATABASE_URL);
  } catch (err) {
    console.error('[webhooks/vista] db init falhou:', err);
    return apiError(503, 'db_unavailable', 'Serviço de dados indisponível.');
  }

  const config = await orgVistaConfigRepo.getByWebhookToken(db, token);
  if (!config) {
    return apiError(404, 'not_found', 'Webhook não encontrado.');
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Body deve ser JSON válido.');
  }

  const parsed = vistaWebhookSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, 'invalid_payload', 'Payload de webhook inválido.', parsed.error.flatten());
  }

  try {
    await processVistaEvent(db, config.orgId, parsed.data);
  } catch (err) {
    console.error('[webhooks/vista] processamento falhou:', err);
    return apiError(500, 'processing_failed', 'Falha ao processar evento.');
  }

  return Response.json({ success: true });
}
