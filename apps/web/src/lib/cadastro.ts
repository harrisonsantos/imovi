/** Payloads do cadastro da Auditoria (cliente). */
import { PRIVACY_VERSION, TERMS_VERSION } from './terms-version';
import type { BillingProduct } from './billing';

export const TERMS_ACCEPT_ENDPOINT = '/api/auditoria/termos';

export function buildTermsAcceptanceBody() {
  return { termsAccepted: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION };
}

export function buildSignupBody(
  input: { name: string; email: string; password: string },
  product: BillingProduct = 'audit',
) {
  return {
    name: input.name,
    email: input.email,
    password: input.password,
    callbackURL:
      product === 'corretor_pro' ? '/conta/login?verified=1' : '/auditoria/login?verified=1',
    ...buildTermsAcceptanceBody(),
  };
}
