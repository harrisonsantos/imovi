/**
 * POST /api/auditoria/matricula/upload — recebe multipart/form-data com
 * `file` (PDF/JPEG/PNG ≤ 10MB) e `imovelId` (uuid da org), grava o binário
 * no bucket R2 `MATRICULAS` e registra os metadados em audit_matriculas.
 *
 * O buffer validado vai para o R2 (sem Buffer/node:*, limitado a 10MB).
 */
import { z } from 'zod';
import { auditImoveisRepo, auditMatriculasRepo } from '@imovi/db/audit';
import { getCfEnv, authEnvOf } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';
import { buildMatriculaKey, validateMatriculaFile } from '@/lib/matricula';
import { requireOrg, sessionGuard } from '@/lib/session';
import { appUrlFromRequest, hasTrustedOrigin } from '@/lib/billing';

const ImovelIdSchema = z.string().uuid();

/** Binding R2 do bucket de matrículas (ver wrangler.toml). */
interface MatriculaBindings {
  MATRICULAS?: R2Bucket;
}

export async function POST(req: Request): Promise<Response> {
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
  let userId: string;
  try {
    const session = await requireOrg(req, authEnvOf(cfEnv));
    orgId = session.org.id;
    userId = session.userId;
  } catch (err) {
    return sessionGuard(err);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError(400, 'invalid_form', 'Body deve ser multipart/form-data.');
  }

  const file = form.get('file');
  const imovelIdRaw = form.get('imovelId');
  if (!(file instanceof File)) {
    return apiError(400, 'invalid_request', 'Campo "file" (arquivo) é obrigatório.');
  }
  const parsedId = ImovelIdSchema.safeParse(imovelIdRaw);
  if (!parsedId.success) {
    return apiError(400, 'invalid_request', 'Campo "imovelId" deve ser um uuid válido.');
  }

  const validation = validateMatriculaFile(file.type, file.size);
  if (!validation.ok) {
    return apiError(400, 'invalid_file', validation.error);
  }

  const buffer = await file.arrayBuffer();
  const contentValidation = validateMatriculaFile(file.type, file.size, new Uint8Array(buffer));
  if (!contentValidation.ok) {
    return apiError(400, 'invalid_file', contentValidation.error);
  }

  const db = getDb(cfEnv.DATABASE_URL);
  // Imóvel precisa existir E pertencer à org da sessão (isolamento).
  const imovel = await auditImoveisRepo.findById(db, orgId, parsedId.data);
  if (!imovel) {
    return apiError(404, 'not_found', 'Imóvel não encontrado.');
  }

  const bucket = (cfEnv as unknown as MatriculaBindings).MATRICULAS;
  if (!bucket) {
    return apiError(503, 'r2_unavailable', 'Bucket de matrículas não configurado.');
  }

  const key = buildMatriculaKey(orgId, imovel.id, file.name);
  await bucket.put(key, buffer, {
    httpMetadata: { contentType: file.type },
  });

  try {
    const row = await auditMatriculasRepo.insert(db, orgId, {
      imovelId: imovel.id,
      r2Key: key,
      fileName: file.name,
      mime: file.type,
      size: file.size,
      uploadedBy: userId,
    });

    return Response.json({ id: row.id, r2Key: row.r2Key });
  } catch (err) {
    await bucket.delete(key).catch(() => undefined);
    throw err;
  }
}
