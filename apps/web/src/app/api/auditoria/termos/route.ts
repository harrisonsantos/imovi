/**
 * POST /api/auditoria/termos — registra o aceite dos Termos de uso e da
 * Política de privacidade vigentes pelo usuário autenticado. Chamado pelo
 * cadastro antes de criar a imobiliária; repetir é idempotente.
 */
import { termsRepo } from '@imovi/db/members';
import { appUrlFromRequest, hasTrustedOrigin } from '@/lib/billing';
import { authEnvOf, getCfEnv } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';
import { requireSession, sessionGuard } from '@/lib/session';
import { isCurrentTermsAcceptance, TERMS_REQUIRED_MESSAGE } from '@/lib/terms';
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/terms-version';

export const runtime = 'edge';

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
  if (!isCurrentTermsAcceptance(body)) {
    return apiError(400, 'terms_not_accepted', TERMS_REQUIRED_MESSAGE);
  }

  try {
    const session = await requireSession(req, authEnvOf(cfEnv));
    const acceptance = await termsRepo.record(getDb(cfEnv.DATABASE_URL), {
      userId: session.userId,
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
      source: 'auditoria_cadastro',
    });
    return Response.json(
      {
        accepted: true,
        termsVersion: acceptance.termsVersion,
        privacyVersion: acceptance.privacyVersion,
        acceptedAt: acceptance.acceptedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    return sessionGuard(err);
  }
}
