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
import { orgRepo } from '@imovi/db/orgs';
import { getCfEnv } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';

export const runtime = 'edge';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await ctx.params;

  const cfEnv = await getCfEnv();

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

  // IMPORTANTE: NÃO chamar assertOrgAccess aqui. A ingestão de dados continua
  // funcionando após o fim do trial (graça de dados de 30 dias) — apenas o
  // dashboard é bloqueado pelo gate em requireOrg. O limite de corretores do
  // plano é aplicado como aviso (warn, don't drop) via maxCorretores abaixo.
  const org = await orgRepo.findById(db, config.orgId);

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

  let limitWarning = false;
  try {
    const result = await processVistaEvent(db, config.orgId, parsed.data, {
      maxCorretores: org?.maxCorretores ?? null,
    });
    limitWarning = result.limitWarning;
  } catch (err) {
    console.error('[webhooks/vista] processamento falhou:', err);
    return apiError(500, 'processing_failed', 'Falha ao processar evento.');
  }

  return Response.json({ success: true, ...(limitWarning ? { limitWarning: true } : {}) });
}
