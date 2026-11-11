import { accountRepo, AccountAnonymizationError } from '@imovi/db/members';
import { appUrlFromRequest, hasTrustedOrigin } from '@/lib/billing';
import { authEnvOf, getCfEnv } from '@/lib/cf-env';
import { getTransactionalDb } from '@/lib/db';
import { apiError } from '@/lib/errors';
import { requireSession, sessionGuard } from '@/lib/session';

export async function POST(req: Request): Promise<Response> {
  const cfEnv = await getCfEnv();
  const appUrl = appUrlFromRequest(
    req,
    cfEnv.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  );
  if (!hasTrustedOrigin(req, appUrl)) {
    return apiError(403, 'invalid_origin', 'Origem da requisição não permitida.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Body deve ser JSON válido.');
  }
  if (!body || typeof body !== 'object' || !('confirm' in body) || body.confirm !== 'EXCLUIR') {
    return apiError(400, 'invalid_confirmation', 'Confirme a exclusão com EXCLUIR.');
  }

  try {
    const session = await requireSession(req, authEnvOf(cfEnv));
    const connection = getTransactionalDb(cfEnv.DATABASE_URL);
    try {
      const user = await accountRepo.anonymize(connection.db, session.userId, new Date());
      if (!user) return apiError(401, 'unauthorized', 'Sessão inválida ou expirada. Faça login.');
      return Response.json({ ok: true, anonymizedAt: user.anonymizedAt?.toISOString() });
    } finally {
      await connection.close();
    }
  } catch (err) {
    if (err instanceof AccountAnonymizationError) {
      return Response.json({ error: 'active_subscription_owner' }, { status: 409 });
    }
    return sessionGuard(err);
  }
}
