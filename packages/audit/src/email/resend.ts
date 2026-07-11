/**
 * Cliente mínimo do Resend (https://resend.com) via `fetch` puro —
 * Workers-safe, sem SDK e sem node:*.
 *
 * Contrato: NUNCA lança. Qualquer falha (HTTP não-2xx ou erro de rede)
 * retorna `{ ok: false, error }` — o cron de auditoria não pode abortar
 * por causa de e-mail.
 */

export interface SendEmailOpts {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

const RESEND_URL = 'https://api.resend.com/emails';

export async function sendEmail(opts: SendEmailOpts): Promise<SendEmailResult> {
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: opts.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });

    if (!res.ok) {
      // Corpo truncado no erro: suficiente para diagnóstico, sem inflar logs.
      const body = await res.text().catch(() => '');
      return { ok: false, error: `resend ${res.status}: ${body.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
