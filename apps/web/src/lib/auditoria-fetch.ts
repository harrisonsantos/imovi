/**
 * Wrapper de fetch para as páginas client do dashboard de auditoria.
 *
 * Centraliza o tratamento de gate de acesso das rotas /api/auditoria/*:
 *   - 403 com error 'trial_expired' ou 'subscription_required' → paywall
 *     (/auditoria/assinatura);
 *   - 401 → login (/auditoria/login);
 *   - qualquer outra resposta passa direto para o chamador (o body permanece
 *     legível — a inspeção do 403 usa res.clone()).
 */

/** Códigos de erro 403 que levam ao paywall. */
const PAYWALL_CODES = new Set(['trial_expired', 'subscription_required']);

export async function fetchAuditoria(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);

  if (res.status === 401) {
    window.location.assign('/auditoria/login');
    return res;
  }

  if (res.status === 403) {
    const body = (await res
      .clone()
      .json()
      .catch(() => null)) as { error?: string } | null;
    if (body?.error && PAYWALL_CODES.has(body.error)) {
      window.location.assign('/auditoria/assinatura');
    }
  }

  return res;
}
