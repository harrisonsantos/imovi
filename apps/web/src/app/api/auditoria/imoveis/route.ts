/**
 * GET /api/auditoria/imoveis — lista enxuta dos imóveis da org
 * (id, endereço, matrícula verificada) para selects do dashboard
 * (ex.: página de matrículas).
 */
import { auditImoveisRepo } from '@imovi/db/audit';
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
  const rows = await auditImoveisRepo.listByOrg(db, orgId);
  const imoveis = rows.map((r) => ({
    id: r.id,
    endereco: r.endereco,
    matriculaVerificada: r.matriculaVerificada ?? false,
  }));
  return Response.json({ imoveis });
}
