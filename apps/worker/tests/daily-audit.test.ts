/**
 * Testes do cron de auditoria diária (fase 5) — `runDailyAudit(deps)` com
 * dependências injetadas (mesmo estilo DI de run-scrape.test.ts).
 *
 * Cobertura:
 *   - isolamento multi-org: falha em uma org não aborta as demais;
 *   - org sem config Vista é pulada (não conta como erro);
 *   - sem RESEND_API_KEY ou sem destinatários → não envia e-mail.
 */
import { describe, expect, it, vi } from 'vitest';

import { runDailyAudit, type RunDailyAuditDeps } from '../src/commands/daily-audit.js';
import { silentLogger } from '../src/logger.js';

const AGORA = new Date('2026-06-10T08:00:00Z');

/** Input de relatório vazio — métricas zeradas, suficiente para os testes. */
const INPUT_VAZIO = {
  now: AGORA,
  leads: [],
  negocios: [],
  corretores: [],
  anomalias: [],
};

function makeDeps(overrides: Partial<RunDailyAuditDeps> = {}): RunDailyAuditDeps {
  return {
    listOrgs: vi.fn(async () => [{ id: 'org-a', name: 'Org A' }]),
    getOrgConfig: vi.fn(async () => ({
      reportEmails: ['gestor@org-a.com.br'],
      avmDeviationPct: 25,
    })),
    runDetectors: vi.fn(async () => ({ detected: 2, inserted: 2 })),
    loadReportInput: vi.fn(async () => INPUT_VAZIO),
    sendEmail: vi.fn(async () => ({ ok: true })),
    resendApiKey: 'rs_teste',
    emailFrom: 'Imovi <auditoria@imovi.app.br>',
    now: AGORA,
    logger: silentLogger,
    ...overrides,
  };
}

describe('runDailyAudit', () => {
  it('processa todas as orgs e envia e-mail com nome da org no assunto/HTML', async () => {
    const sendEmail = vi.fn(async () => ({ ok: true }));
    const deps = makeDeps({ sendEmail });

    const summary = await runDailyAudit(deps);

    expect(summary).toEqual({ orgs: 1, anomaliasInserted: 2, emailsSent: 1, errors: 0 });
    expect(sendEmail).toHaveBeenCalledOnce();
    const call = sendEmail.mock.calls[0] as unknown as [
      { apiKey: string; from: string; to: string[]; subject: string; html: string },
    ];
    expect(call[0].apiKey).toBe('rs_teste');
    expect(call[0].from).toBe('Imovi <auditoria@imovi.app.br>');
    expect(call[0].to).toEqual(['gestor@org-a.com.br']);
    expect(call[0].subject).toContain('Org A');
    expect(call[0].html).toContain('Org A');
  });

  it('falha na org B não aborta a org A nem a org C; erro é contado', async () => {
    const processadas: string[] = [];
    const deps = makeDeps({
      listOrgs: vi.fn(async () => [
        { id: 'org-a', name: 'Org A' },
        { id: 'org-b', name: 'Org B' },
        { id: 'org-c', name: 'Org C' },
      ]),
      runDetectors: vi.fn(async (orgId: string) => {
        if (orgId === 'org-b') throw new Error('vista fora do ar');
        processadas.push(orgId);
        return { detected: 1, inserted: 1 };
      }),
    });

    const summary = await runDailyAudit(deps);

    expect(processadas).toEqual(['org-a', 'org-c']);
    expect(summary.orgs).toBe(3);
    expect(summary.errors).toBe(1);
    expect(summary.anomaliasInserted).toBe(2); // só A e C inseriram
    expect(summary.emailsSent).toBe(2);
  });

  it('org sem config Vista é pulada: sem detectores, sem e-mail, sem erro', async () => {
    const runDetectors = vi.fn(async () => ({ detected: 0, inserted: 0 }));
    const sendEmail = vi.fn(async () => ({ ok: true }));
    const deps = makeDeps({
      getOrgConfig: vi.fn(async () => null),
      runDetectors,
      sendEmail,
    });

    const summary = await runDailyAudit(deps);

    expect(runDetectors).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(summary).toEqual({ orgs: 1, anomaliasInserted: 0, emailsSent: 0, errors: 0 });
  });

  it('sem resendApiKey, roda detectores mas não envia e-mail', async () => {
    const sendEmail = vi.fn(async () => ({ ok: true }));
    const deps = makeDeps({ resendApiKey: undefined, sendEmail });

    const summary = await runDailyAudit(deps);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(summary.anomaliasInserted).toBe(2); // detectores rodaram
    expect(summary.emailsSent).toBe(0);
    expect(summary.errors).toBe(0);
  });

  it('config sem destinatários (reportEmails vazio) → não envia e-mail', async () => {
    const sendEmail = vi.fn(async () => ({ ok: true }));
    const deps = makeDeps({
      getOrgConfig: vi.fn(async () => ({ reportEmails: [], avmDeviationPct: 25 })),
      sendEmail,
    });

    const summary = await runDailyAudit(deps);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(summary.emailsSent).toBe(0);
  });

  it('falha no envio do e-mail (ok:false) não conta como erro de org', async () => {
    const deps = makeDeps({
      sendEmail: vi.fn(async () => ({ ok: false, error: 'resend 500' })),
    });

    const summary = await runDailyAudit(deps);

    expect(summary.emailsSent).toBe(0);
    expect(summary.errors).toBe(0);
  });

  it('repassa avmDeviationPct da config como deviationPct dos detectores', async () => {
    const runDetectors = vi.fn(async () => ({ detected: 0, inserted: 0 }));
    const deps = makeDeps({
      getOrgConfig: vi.fn(async () => ({ reportEmails: [], avmDeviationPct: 40 })),
      runDetectors,
    });

    await runDailyAudit(deps);

    expect(runDetectors).toHaveBeenCalledWith('org-a', { now: AGORA, deviationPct: 40 });
  });
});
