/**
 * Comando do cron de auditoria diária (fase 5).
 *
 * Para cada organização ativa ('trial' ou 'active'):
 *   1. carrega a config Vista da org (sem config → org pulada);
 *   2. roda os detectores de anomalia (com bairros AVM injetados);
 *   3. monta o relatório diário (métricas puras);
 *   4. envia o e-mail via Resend quando há API key e destinatários.
 *
 * Cada org é isolada em try/catch — falha em uma não aborta as demais.
 * Núcleo testável `runDailyAudit(deps)` com dependências injetadas (mesmo
 * estilo DI de pipeline/run-scrape.ts) + wrapper fino `runDailyAuditCommand`
 * que liga as implementações reais (repos + Resend). Workers-safe: sem node:*.
 */
import { createDbClient, neighborhoods, type AnyDbClient } from '@imovi/db';
import { orgRepo } from '@imovi/db/orgs';
import {
  auditAnomaliasRepo,
  auditCorretoresRepo,
  auditLeadsRepo,
  auditNegociosRepo,
  orgVistaConfigRepo,
} from '@imovi/db/audit';
import { runDetectors, type NeighborhoodRef } from '@imovi/audit/detectors';
import {
  buildDailyReport,
  dailyReportHtml,
  sendEmail,
  type DailyReportInput,
  type SendEmailOpts,
  type SendEmailResult,
} from '@imovi/audit/email';
import type { Logger } from '../logger.js';

/** Remetente padrão quando EMAIL_FROM não é configurado. */
export const DEFAULT_EMAIL_FROM = 'Imovi <auditoria@imovi.app.br>';

export interface DailyAuditOrg {
  id: string;
  name: string;
}

export interface DailyAuditOrgConfig {
  reportEmails: string[];
  avmDeviationPct: number | null;
}

/** Dependências injetáveis do núcleo — fakes nos testes, repos reais no comando. */
export interface RunDailyAuditDeps {
  listOrgs(): Promise<DailyAuditOrg[]>;
  getOrgConfig(orgId: string): Promise<DailyAuditOrgConfig | null>;
  runDetectors(
    orgId: string,
    opts: { now: Date; deviationPct?: number },
  ): Promise<{ detected: number; inserted: number }>;
  loadReportInput(orgId: string, now: Date): Promise<DailyReportInput>;
  sendEmail(opts: SendEmailOpts): Promise<SendEmailResult>;
  /** Sem API key → detectores rodam, e-mail é pulado. */
  resendApiKey?: string;
  emailFrom: string;
  /** Instante de referência (default: agora) — injetável nos testes. */
  now?: Date;
  logger: Logger;
}

export interface DailyAuditSummary {
  orgs: number;
  anomaliasInserted: number;
  emailsSent: number;
  errors: number;
}

export async function runDailyAudit(deps: RunDailyAuditDeps): Promise<DailyAuditSummary> {
  const now = deps.now ?? new Date();
  const summary: DailyAuditSummary = { orgs: 0, anomaliasInserted: 0, emailsSent: 0, errors: 0 };

  const orgs = await deps.listOrgs();
  summary.orgs = orgs.length;

  for (const org of orgs) {
    try {
      const config = await deps.getOrgConfig(org.id);
      if (config == null) {
        deps.logger.info('daily_audit_org_skipped', { orgId: org.id, reason: 'sem_config_vista' });
        continue;
      }

      const detectores = await deps.runDetectors(org.id, {
        now,
        ...(config.avmDeviationPct != null ? { deviationPct: config.avmDeviationPct } : {}),
      });
      summary.anomaliasInserted += detectores.inserted;

      const report = buildDailyReport(await deps.loadReportInput(org.id, now));

      // E-mail é best-effort: exige API key e destinatários; falha não derruba a org.
      let emailSent = false;
      if (deps.resendApiKey && config.reportEmails.length > 0) {
        const result = await deps.sendEmail({
          apiKey: deps.resendApiKey,
          from: deps.emailFrom,
          to: config.reportEmails,
          subject: `Auditoria diária — ${org.name} (${report.dataReferencia})`,
          html: dailyReportHtml(report, org.name),
        });
        if (result.ok) {
          emailSent = true;
          summary.emailsSent += 1;
        } else {
          deps.logger.warn('daily_audit_email_failed', { orgId: org.id, error: result.error });
        }
      }

      deps.logger.info('daily_audit_org_done', {
        orgId: org.id,
        detected: detectores.detected,
        inserted: detectores.inserted,
        leadsDoDia: report.leadsDoDia,
        negociosFechadosDoDia: report.negociosFechadosDoDia,
        emailSent,
      });
    } catch (err) {
      summary.errors += 1;
      deps.logger.error('daily_audit_org_error', {
        orgId: org.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return summary;
}

export interface DailyAuditCommandOpts {
  databaseUrl: string;
  resendApiKey?: string;
  emailFrom?: string;
  logger: Logger;
}

/** Lê os bairros do AVM (tabela `neighborhoods`) na forma que o detector espera. */
async function fetchNeighborhoods(db: AnyDbClient): Promise<NeighborhoodRef[]> {
  return await db
    .select({
      name: neighborhoods.name,
      city: neighborhoods.city,
      state: neighborhoods.state,
      medianPriceM2: neighborhoods.medianPriceM2,
    })
    .from(neighborhoods);
}

/** Wrapper fino: liga repos reais + Resend ao núcleo `runDailyAudit`. */
export async function runDailyAuditCommand(
  opts: DailyAuditCommandOpts,
): Promise<DailyAuditSummary> {
  const db = createDbClient({ connectionString: opts.databaseUrl }) as unknown as AnyDbClient;

  const summary = await runDailyAudit({
    listOrgs: async () =>
      (await orgRepo.listActiveForAudit(db)).map((o) => ({ id: o.id, name: o.name })),

    getOrgConfig: async (orgId) => {
      const config = await orgVistaConfigRepo.getByOrg(db, orgId);
      if (config == null) return null;
      // reportEmails é jsonb — valida a forma (array de strings) na borda.
      const reportEmails = Array.isArray(config.reportEmails)
        ? config.reportEmails.filter((e): e is string => typeof e === 'string')
        : [];
      return { reportEmails, avmDeviationPct: config.avmDeviationPct };
    },

    runDetectors: (orgId, detectorOpts) =>
      runDetectors(db, orgId, {
        ...detectorOpts,
        fetchNeighborhoods: () => fetchNeighborhoods(db),
      }),

    loadReportInput: async (orgId, now) => {
      const [leads, negocios, corretores, anomalias] = await Promise.all([
        auditLeadsRepo.listByOrg(db, orgId),
        auditNegociosRepo.listByOrg(db, orgId),
        auditCorretoresRepo.listByOrg(db, orgId),
        auditAnomaliasRepo.listByOrg(db, orgId, { resolvida: false, limit: 500 }),
      ]);
      return {
        now,
        leads: leads.map((l) => ({
          id: l.id,
          corretorId: l.corretorId,
          createdAt: l.createdAt,
        })),
        negocios: negocios.map((n) => ({
          id: n.id,
          corretorId: n.corretorId,
          status: n.status,
          dataFechamento: n.dataFechamento,
        })),
        corretores: corretores.map((c) => ({ id: c.id, nome: c.nome })),
        anomalias: anomalias.map((a) => ({
          severidade: a.severidade,
          createdAt: a.createdAt,
        })),
      };
    },

    sendEmail,
    resendApiKey: opts.resendApiKey,
    emailFrom: opts.emailFrom ?? DEFAULT_EMAIL_FROM,
    logger: opts.logger,
  });

  opts.logger.info('daily_audit_command_result', { ...summary });
  return summary;
}
