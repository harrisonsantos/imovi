/**
 * POST /api/auditoria/matricula/check — body { id } (uuid da matrícula).
 *
 * Marca a matrícula como verificada MANUALMENTE: não existe API pública de
 * consulta de matrículas no Brasil (o "check" do legado também não consultava
 * registro algum), então o resultado é um stub honesto:
 *   { status: 'verificacao_manual_pendente', checkedVia: 'manual' }
 * e o imóvel correspondente ganha matricula_verificada = true.
 */
import { z } from 'zod';
import { auditImoveisRepo, auditMatriculasRepo } from '@imovi/db/audit';
import { getCfEnv, authEnvOf } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';
import { requireOrg, sessionGuard } from '@/lib/session';

export const runtime = 'edge';

const CheckSchema = z.object({ id: z.string().uuid() });

export async function POST(req: Request): Promise<Response> {
  const cfEnv = await getCfEnv();
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
  const parsed = CheckSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, 'invalid_request', 'Parâmetros inválidos.', parsed.error.flatten());
  }

  const db = getDb(cfEnv.DATABASE_URL);
  const matricula = await auditMatriculasRepo.findById(db, orgId, parsed.data.id);
  if (!matricula) {
    return apiError(404, 'not_found', 'Matrícula não encontrada.');
  }

  const resultado = { status: 'verificacao_manual_pendente', checkedVia: 'manual' } as const;
  await auditMatriculasRepo.setChecked(db, orgId, matricula.id, resultado);
  await auditImoveisRepo.setMatriculaVerificada(db, orgId, matricula.imovelId, true);

  return Response.json({ ok: true, resultado });
}
