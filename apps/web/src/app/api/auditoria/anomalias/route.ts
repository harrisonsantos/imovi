/**
 * GET /api/auditoria/anomalias — lista anomalias da org com filtros
 * (?resolvida=&tipo=&limit=&offset=), mais recentes primeiro.
 * PATCH — body { id } → marca a anomalia como resolvida (escopado por org).
 */
import { z } from 'zod';
import { auditAnomaliasRepo } from '@imovi/db/audit';
import { parseAnomaliasQuery } from '@/lib/auditoria-query';
import { getCfEnv, authEnvOf } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';
import { requireOrg, sessionGuard } from '@/lib/session';
import { appUrlFromRequest, hasTrustedOrigin } from '@/lib/billing';

const ResolvePatchSchema = z.object({ id: z.string().uuid() });

export async function GET(req: Request): Promise<Response> {
  const cfEnv = await getCfEnv();
  let orgId: string;
  try {
    orgId = (await requireOrg(req, authEnvOf(cfEnv))).org.id;
  } catch (err) {
    return sessionGuard(err);
  }

  const query = parseAnomaliasQuery(new URL(req.url).searchParams);
  const db = getDb(cfEnv.DATABASE_URL);
  const rows = await auditAnomaliasRepo.listByOrg(db, orgId, {
    resolvida: query.resolvida,
    tipo: query.tipo,
    limit: query.limit,
    offset: query.offset,
    order: 'desc',
  });

  return Response.json({ anomalias: rows, limit: query.limit, offset: query.offset });
}

export async function PATCH(req: Request): Promise<Response> {
  const cfEnv = await getCfEnv();
  if (
    !hasTrustedOrigin(
      req,
      appUrlFromRequest(req, cfEnv.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL),
    )
  ) {
    return Response.json({ error: 'Invalid origin' }, { status: 403 });
  }
  let orgId: string;
  try {
    orgId = (await requireOrg(req, authEnvOf(cfEnv))).org.id;
  } catch (err) {
    return sessionGuard(err);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Body deve ser JSON válido.');
  }
  const parsed = ResolvePatchSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, 'invalid_request', 'Parâmetros inválidos.', parsed.error.flatten());
  }

  const db = getDb(cfEnv.DATABASE_URL);
  await auditAnomaliasRepo.resolve(db, orgId, parsed.data.id);
  return Response.json({ ok: true });
}
