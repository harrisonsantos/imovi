/// <reference types="@cloudflare/workers-types" />
/**
 * worker-entrypoint.ts — Entrypoint para Cloudflare Workers (cron triggers)
 *
 * Este arquivo é o `main` do wrangler.toml.
 * O cli.ts continua existindo para execução local via Node.js.
 *
 * Crons configurados no wrangler.toml:
 *   "0 6 * * *"   — scrape diário 03:00 BRT
 *   "0 7 * * 1"   — enrich-iptu semanal segunda 04:00 BRT
 *   "0 8 * * *"   — auditoria diária + e-mail 05:00 BRT
 */

import { consoleLogger } from './logger.js';
import { createDbClient } from '@imovi/db';
import { sql } from '@imovi/db/operators';
import { runScrapeCommand } from './commands/scrape.js';
import { runEnrichIptuCommand } from './commands/enrich-iptu.js';
import { createIptuAdapters } from './commands/iptu-config.js';
import { KvIptuCache } from '@imovi/enrichment';
import { runDailyAuditCommand, DEFAULT_EMAIL_FROM } from './commands/daily-audit.js';

export interface Env {
  DATABASE_URL: string;
  IPTU_CACHE: KVNamespace;
  INFOSIMPLES_TOKEN?: string;
  INFOSIMPLES_CURITIBA_ENDPOINT?: string;
  HTML_SNAPSHOTS: R2Bucket;
  LOG_LEVEL?: string;
  /** Secret opcional — sem ela a auditoria roda sem enviar e-mails. */
  RESEND_API_KEY?: string;
  /** Remetente opcional — default 'Imovi <auditoria@imovi.app.br>'. */
  EMAIL_FROM?: string;
}

export default {
  /**
   * Scheduled handler — invocado pelos cron triggers do wrangler.toml
   * cron "0 6 * * *"  → scrape diário
   * cron "0 7 * * 1"  → enrich-iptu semanal
   * cron "0 8 * * *"  → auditoria diária + e-mail
   */
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const logger = consoleLogger;
    const databaseUrl = env.DATABASE_URL;

    logger.info('worker_scheduled_start', { cron: controller.cron });

    // Rotear pelo cron expression
    if (controller.cron === '0 6 * * *') {
      // Scrape diário — todas as sources
      ctx.waitUntil(
        runScrapeCommand({
          sources: ['zap', 'vivareal', 'olx'],
          databaseUrl,
          logger,
        })
          .then(() => logger.info('worker_scrape_done', { cron: controller.cron }))
          .catch((err: unknown) => {
            logger.error('worker_scrape_error', {
              error: err instanceof Error ? err.message : String(err),
            });
            throw err;
          }),
      );
    } else if (controller.cron === '0 7 * * 1') {
      // Enrich IPTU semanal
      ctx.waitUntil(
        runEnrichIptuCommand({
          databaseUrl,
          logger,
          ...createIptuAdapters(env, logger),
          cache: new KvIptuCache(env.IPTU_CACHE),
        })
          .then(() => logger.info('worker_enrich_done', { cron: controller.cron }))
          .catch((err: unknown) => {
            logger.error('worker_enrich_error', {
              error: err instanceof Error ? err.message : String(err),
            });
            throw err;
          }),
      );
    } else if (controller.cron === '0 8 * * *') {
      // Auditoria diária: detectores + relatório por e-mail
      ctx.waitUntil(
        runDailyAuditCommand({
          databaseUrl,
          resendApiKey: env.RESEND_API_KEY,
          emailFrom: env.EMAIL_FROM ?? DEFAULT_EMAIL_FROM,
          logger,
        })
          .then((summary) =>
            logger.info('worker_daily_audit_done', { cron: controller.cron, ...summary }),
          )
          .catch((err: unknown) =>
            logger.error('worker_daily_audit_error', {
              error: err instanceof Error ? err.message : String(err),
            }),
          ),
      );
    } else {
      logger.warn('worker_unknown_cron', { cron: controller.cron });
    }
  },

  /**
   * Fetch handler mínimo — permite smoke test via HTTP
   * GET https://imovi-worker.<account>.workers.dev/health
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/ready') {
      try {
        await createDbClient({ connectionString: env.DATABASE_URL }).execute(sql`SELECT 1`);
        return Response.json({ status: 'ok', db: 'ok' });
      } catch {
        return Response.json({ status: 'unavailable', db: 'unavailable' }, { status: 503 });
      }
    }
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        worker: 'imovi-worker',
        ts: new Date().toISOString(),
      });
    }
    return new Response('imovi-worker — use /health', { status: 200 });
  },
} satisfies ExportedHandler<Env>;
