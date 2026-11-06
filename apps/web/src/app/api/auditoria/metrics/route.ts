/**
 * GET /api/auditoria/metrics — KPIs do dashboard de auditoria da org ativa.
 *
 * Retorna contagens agregadas: leads (total/hoje), negócios (total/fechados no
 * mês corrente), anomalias não resolvidas por severidade e corretores ativos.
 * Inclui o nome da org para o header do layout (evita endpoint extra).
 */
import {
  auditAnomaliasRepo,
  auditCorretoresRepo,
  auditLeadsRepo,
  auditNegociosRepo,
} from '@imovi/db/audit';
import { getCfEnv, authEnvOf } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { requireOrg, sessionGuard, type OrgSessionInfo } from '@/lib/session';


export async function GET(req: Request): Promise<Response> {
  const cfEnv = await getCfEnv();
  let session: OrgSessionInfo;
  try {
    session = await requireOrg(req, authEnvOf(cfEnv));
  } catch (err) {
    return sessionGuard(err);
  }

  const db = getDb(cfEnv.DATABASE_URL);
  const orgId = session.org.id;

  const agora = new Date();
  const inicioHoje = new Date(agora);
  inicioHoje.setHours(0, 0, 0, 0);
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

  const [leadsTotal, leadsHoje, negociosTotal, negociosFechadosMes, porSeveridade, corretoresAtivos] =
    await Promise.all([
      auditLeadsRepo.countByOrg(db, orgId),
      auditLeadsRepo.countByOrg(db, orgId, { createdAfter: inicioHoje }),
      auditNegociosRepo.countByOrg(db, orgId),
      auditNegociosRepo.countByOrg(db, orgId, { closedAfter: inicioMes }),
      auditAnomaliasRepo.countUnresolvedBySeverity(db, orgId),
      auditCorretoresRepo.countActive(db, orgId),
    ]);

  const naoResolvidas = { alta: 0, media: 0, baixa: 0, total: 0 };
  for (const { severidade, total } of porSeveridade) {
    if (severidade === 'alta' || severidade === 'media' || severidade === 'baixa') {
      naoResolvidas[severidade] = total;
    }
    naoResolvidas.total += total;
  }

  return Response.json({
    org: { id: session.org.id, name: session.org.name },
    leads: { total: leadsTotal, hoje: leadsHoje },
    negocios: { total: negociosTotal, fechadosNoMes: negociosFechadosMes },
    anomalias: { naoResolvidas },
    corretores: { ativos: corretoresAtivos },
  });
}
