/**
 * Testes de fetchAuditoria — wrapper de fetch do dashboard de auditoria.
 *
 * Comportamento esperado:
 *   - 403 com error 'trial_expired' ou 'subscription_required' → redireciona
 *     para /auditoria/assinatura (paywall);
 *   - 401 → redireciona para /auditoria/login;
 *   - demais respostas passam direto, com body ainda legível pelo chamador.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAuditoria } from '../src/lib/auditoria-fetch';

const assign = vi.fn();
const mockFetch = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('window', { location: { assign } });
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('fetchAuditoria', () => {
  it('403 trial_expired → redireciona para /auditoria/assinatura', async () => {
    mockFetch.mockResolvedValue(jsonResponse(403, { error: 'trial_expired', message: 'x' }));

    await fetchAuditoria('/api/auditoria/metrics');

    expect(assign).toHaveBeenCalledWith('/auditoria/assinatura');
  });

  it('403 subscription_required → redireciona para /auditoria/assinatura', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(403, { error: 'subscription_required', message: 'x' }),
    );

    await fetchAuditoria('/api/auditoria/metrics');

    expect(assign).toHaveBeenCalledWith('/auditoria/assinatura');
  });

  it('403 com outro código (ex.: no_organization) NÃO redireciona', async () => {
    mockFetch.mockResolvedValue(jsonResponse(403, { error: 'no_organization', message: 'x' }));

    const res = await fetchAuditoria('/api/auditoria/metrics');

    expect(assign).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });

  it('401 → redireciona para /auditoria/login', async () => {
    mockFetch.mockResolvedValue(jsonResponse(401, { error: 'unauthorized', message: 'x' }));

    await fetchAuditoria('/api/auditoria/metrics');

    expect(assign).toHaveBeenCalledWith('/auditoria/login');
  });

  it('200 passa direto, sem redirecionar, e o body continua legível', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, { ok: true }));

    const res = await fetchAuditoria('/api/auditoria/metrics');

    expect(assign).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('repassa input e init para o fetch nativo', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, { ok: true }));
    const init = { method: 'PATCH', body: '{}' };

    await fetchAuditoria('/api/auditoria/anomalias', init);

    expect(mockFetch).toHaveBeenCalledWith('/api/auditoria/anomalias', init);
  });

  it('403 com body não-JSON não explode nem redireciona', async () => {
    mockFetch.mockResolvedValue(new Response('forbidden', { status: 403 }));

    const res = await fetchAuditoria('/api/auditoria/metrics');

    expect(assign).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });
});
