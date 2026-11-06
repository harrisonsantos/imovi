/**
 * GET /api/auditoria/corretores — lista corretores da org (ordenados por nome).
 */
import { auditCorretoresRepo } from '@imovi/db/audit';
import { getCfEnv, authEnvOf } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { requireOrg, sessionGuard } from '@/lib/session';


export async function GET(req: Request): Promise<Response> {
  const cfEnv = await getCfEnv();
  let orgId: string;
  try {
    orgId = (await requireOrg(req, authEnvOf(cfEnv))).org.id;
  } catch (err) {
    return sessionGuard(err);
  }

  const db = getDb(cfEnv.DATABASE_URL);
  const corretores = await auditCorretoresRepo.listByOrg(db, orgId);
  return Response.json({ corretores });
}
