/**
 * GET /api/auditoria/negocios — lista negócios da org (?limit=&offset=) com o
 * imóvel relacionado (endereço), mais recentes primeiro.
 */
import { auditNegociosRepo } from '@imovi/db/audit';
import { parsePagination } from '@/lib/auditoria-query';
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

  const { limit, offset } = parsePagination(new URL(req.url).searchParams);
  const db = getDb(cfEnv.DATABASE_URL);
  const rows = await auditNegociosRepo.listWithImovel(db, orgId, { limit, offset });

  // Achata negócio + imóvel no formato que a tabela consome.
  const negocios = rows.map(({ negocio, imovel }) => ({
    id: negocio.id,
    vistaId: negocio.vistaId,
    corretorId: negocio.corretorId,
    endereco: imovel?.endereco ?? null,
    valorVenda: negocio.valorVenda,
    comissaoValor: negocio.comissaoValor,
    dataFechamento: negocio.dataFechamento,
    status: negocio.status,
    createdAt: negocio.createdAt,
  }));

  return Response.json({ negocios, limit, offset });
}
