import type { Operation } from '@imovi/shared';
import type { Fetcher } from './fetcher.js';
import type { RateLimiter } from './rate-limiter.js';
import type { RobotsPolicy } from './robots.js';

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
}
