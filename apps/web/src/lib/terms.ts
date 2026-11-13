/**
 * Regras de servidor do aceite dos termos. O cadastro (better-auth) recusa
 * contas sem aceite da versão vigente, e nenhuma imobiliária é criada sem
 * aceite gravado em `terms_acceptances`.
 */
import { APIError } from 'better-auth/api';
import { termsRepo } from '@imovi/db/members';
import { PRIVACY_VERSION, TERMS_VERSION } from './terms-version';

type AnyDbClient = Parameters<typeof termsRepo.record>[0];

export const TERMS_REQUIRED_MESSAGE =
  'Aceite a versão vigente dos Termos de uso e da Política de privacidade para continuar.';

export function isCurrentTermsAcceptance(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    b.termsAccepted === true &&
    b.termsVersion === TERMS_VERSION &&
    b.privacyVersion === PRIVACY_VERSION
  );
}

export function assertSignupTermsAccepted(body: unknown): void {
  if (!isCurrentTermsAcceptance(body)) {
    throw new APIError('BAD_REQUEST', {
      code: 'TERMS_NOT_ACCEPTED',
      message: TERMS_REQUIRED_MESSAGE,
    });
  }
}

export async function recordSignupAcceptance(db: AnyDbClient, userId: string): Promise<void> {
  await termsRepo.record(db, {
    userId,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    source: 'signup',
  });
}

export async function requireCurrentTermsAcceptance(
  db: AnyDbClient,
  userId: string,
): Promise<void> {
  if (!(await termsRepo.hasAccepted(db, userId, TERMS_VERSION))) {
    throw new APIError('FORBIDDEN', {
      code: 'TERMS_NOT_ACCEPTED',
      message: TERMS_REQUIRED_MESSAGE,
    });
  }
}
