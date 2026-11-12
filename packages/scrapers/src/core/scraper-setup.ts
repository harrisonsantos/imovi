/**
 * Helpers comuns aos 3 adapters de scraping (zap/vivareal/olx):
 *   - resolve Fetcher com User-Agent default
 *   - resolve RateLimiter default (1 req/s por host)
 *   - carrega RobotsPolicy (rede) se não injetada
 *
 * Extraído pra evitar duplicação e uniformizar identidade do bot nos
 * logs dos portais (User-Agent: `ImoviBR-Bot/1.0 (+https://imovi.app.br/bot)`).
 */
import { Fetcher } from './fetcher.js';
import { RateLimiter } from './rate-limiter.js';
import { fetchRobotsPolicy, parseRobotsTxt, type RobotsPolicy } from './robots.js';
import type { ScrapeOptions } from './types.js';

export const DEFAULT_USER_AGENT =
  'ImoviBR-Bot/1.0 (+https://imovi.app.br/bot)';

export interface ResolvedScraperDeps {
  fetcher: Fetcher;
  limiter: RateLimiter;
  policy: RobotsPolicy;
  userAgent: string;
}

/**
 * Monta dependências prontas a partir das opções. Chamado uma vez por
 * adapter, antes do loop de paginação.
 */
export async function resolveScraperDeps(
  host: string,
  opts: ScrapeOptions,
): Promise<ResolvedScraperDeps> {
  const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;
  const fetcher = opts.fetcher ?? new Fetcher({ userAgent });
  const limiter = opts.rateLimiter ?? new RateLimiter({ minIntervalMs: 1000 });
  const policy =
    opts.robotsPolicy ??
    (await fetchRobotsPolicy(host, ((url: string | URL | Request, init?: RequestInit) =>
      fetcher.get(String(url), init)) as typeof fetch));
  return { fetcher, limiter, policy, userAgent };
}

/** Stub de policy "allow all" — usado em testes. */
export const ALLOW_ALL_POLICY: RobotsPolicy = parseRobotsTxt('');
