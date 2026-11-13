import type { Operation } from '@imovi/shared';
import type { Fetcher } from './fetcher.js';
import type { RateLimiter } from './rate-limiter.js';
import type { RobotsPolicy } from './robots.js';

export type ScrapeFailureReason =
  | 'robots_disallowed'
  | `http_status_${number}`
  | 'parser_zero_items';

export interface ScrapeDiagnostic {
  reason: ScrapeFailureReason;
  url: string;
  page: number;
  status?: number;
}

export class ScrapeDiagnosticError extends Error {
  readonly reason: ScrapeFailureReason;
  readonly url: string;
  readonly page: number;
  readonly status?: number;

  constructor(diag: ScrapeDiagnostic) {
    super(diag.reason);
    this.name = 'ScrapeDiagnosticError';
    this.reason = diag.reason;
    this.url = diag.url;
    this.page = diag.page;
    this.status = diag.status;
  }
}

/** Opções comuns para todos os adapters de scraping. */
export interface ScrapeOptions {
  /** Ex: 'sao-paulo-sp'. Formato específico por portal. */
  location: string;
  /** Operação a buscar. */
  operation: Operation;
  /** Número máximo de páginas a percorrer. Default: 1. */
  maxPages?: number;
  /** Fetcher injetável (testes). Se omitido, usa fetch global com defaults. */
  fetcher?: Fetcher;
  /** RateLimiter injetável. Se omitido, um default 1req/s é criado. */
  rateLimiter?: RateLimiter;
  /**
   * Policy de robots.txt. Se omitido, o scraper busca o arquivo do host
   * e parseia. Injete um `parseRobotsTxt('')` em testes pra pular.
   */
  robotsPolicy?: RobotsPolicy;
  /** User-agent enviado nos fetches. Default: `ImoviBR-Bot/1.0`. */
  userAgent?: string;
  /** Callback opcional de diagnóstico para falhas ou página vazia. */
  onDiagnostic?: (diag: ScrapeDiagnostic) => void;
}
