/**
 * Testes do cliente Resend (fase 5 — e-mail do relatório diário).
 *
 * O contrato central: `sendEmail` NUNCA lança — qualquer falha (HTTP não-2xx
 * ou erro de rede) vira `{ ok: false, error }`, para que o cron de auditoria
 * nunca aborte por causa de e-mail.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '../src/email/resend.js';

const OPTS = {
  apiKey: 'rs_teste_123',
  from: 'Imovi <auditoria@imovi.app.br>',
  to: ['gestor@imobiliaria.com.br'],
  subject: 'Auditoria diária',
  html: '<p>relatório</p>',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendEmail (Resend via fetch)', () => {
  it('faz POST em /emails com Bearer token e payload correto; sucesso → ok:true', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'email-1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendEmail(OPTS);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer rs_teste_123');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({
      from: OPTS.from,
      to: OPTS.to,
      subject: OPTS.subject,
      html: OPTS.html,
    });
  });

  it('resposta não-2xx → ok:false com status no erro (não lança)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"message":"invalid from"}', { status: 422 })),
    );

    const result = await sendEmail(OPTS);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('422');
  });

  it('falha de rede (fetch rejeita) → ok:false com a mensagem (não lança)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('rede caiu');
      }),
    );

    const result = await sendEmail(OPTS);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('rede caiu');
  });
});
