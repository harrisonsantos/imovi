/** Payloads do cadastro da Auditoria (cliente). */
import { PRIVACY_VERSION, TERMS_VERSION } from './terms-version';

export const TERMS_ACCEPT_ENDPOINT = '/api/auditoria/termos';

export function buildTermsAcceptanceBody() {
  return { termsAccepted: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION };
}

export function buildSignupBody(input: { name: string; email: string; password: string }) {
  return {
    name: input.name,
    email: input.email,
    password: input.password,
    callbackURL: '/auditoria/login?verified=1',
    ...buildTermsAcceptanceBody(),
  };
}
