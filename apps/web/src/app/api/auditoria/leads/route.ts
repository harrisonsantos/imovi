/**
 * GET /api/auditoria/leads — lista leads da org (?status=&limit=&offset=),
 * mais recentemente atualizados primeiro.
 */
import { auditLeadsRepo } from '@imovi/db/audit';
import { parseLeadsQuery } from '@/lib/auditoria-query';
import { getCfEnv, authEnvOf } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { requireOrg, sessionGuard } from '@/lib/session';

export const runtime = 'edge';

export async function GET(req: Request): Promise<Response> {
  const cfEnv = await getCfEnv();
  let orgId: string;
  try {
    orgId = (await requireOrg(req, authEnvOf(cfEnv))).org.id;
  } catch (err) {
    return sessionGuard(err);
  }

  const query = parseLeadsQuery(new URL(req.url).searchParams);
  const db = getDb(cfEnv.DATABASE_URL);
  const rows = await auditLeadsRepo.listByOrg(db, orgId, {
    status: query.status,
    limit: query.limit,
    offset: query.offset,
  });

  return Response.json({ leads: rows, limit: query.limit, offset: query.offset });
}
