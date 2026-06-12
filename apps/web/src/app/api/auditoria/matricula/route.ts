/**
 * GET /api/auditoria/matricula — lista as matrículas enviadas pela org,
 * mais recentes primeiro, com filtro opcional ?imovelId= e paginação
 * ?limit=&offset=.
 */
import { z } from 'zod';
import { auditMatriculasRepo } from '@imovi/db/audit';
import { parsePagination } from '@/lib/auditoria-query';
import { getCfEnv, authEnvOf } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';
import { requireOrg, sessionGuard } from '@/lib/session';

export const runtime = 'edge';

const ImovelIdSchema = z.string().uuid();

export async function GET(req: Request): Promise<Response> {
  const cfEnv = await getCfEnv();
  let orgId: string;
  try {
    orgId = (await requireOrg(req, authEnvOf(cfEnv))).org.id;
  } catch (err) {
    return sessionGuard(err);
  }

  const searchParams = new URL(req.url).searchParams;
  const { limit, offset } = parsePagination(searchParams);
  const imovelIdRaw = searchParams.get('imovelId');
  let imovelId: string | undefined;
  if (imovelIdRaw !== null && imovelIdRaw !== '') {
    const parsed = ImovelIdSchema.safeParse(imovelIdRaw);
    if (!parsed.success) {
      return apiError(400, 'invalid_request', 'Parâmetro "imovelId" deve ser um uuid válido.');
    }
    imovelId = parsed.data;
  }

  const db = getDb(cfEnv.DATABASE_URL);
  const rows = await auditMatriculasRepo.listByOrg(db, orgId, { imovelId, limit, offset });
  return Response.json({ matriculas: rows, limit, offset });
}
