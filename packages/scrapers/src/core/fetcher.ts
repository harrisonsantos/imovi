/**
 * Camada HTTP injetável com retry exponencial, respeito ao header Retry-After
 * em respostas 429/503, headers de localização pt-BR e cookie jar por host
 * (preservando cookies de desafio como `__cf_bm` e `_cfuvid` entre requisições).
 */
export type FetchTransport = (url: string, init?: RequestInit) => Promise<Response>;
export type SleepFn = (ms: number) => Promise<void>;

export interface FetcherOptions {
  /** Transporte HTTP. Default: `globalThis.fetch`. */
  transport?: FetchTransport;
  /** Número máximo de tentativas (inclui a primeira). Default: 3. */
  maxRetries?: number;
  /** Backoff base em ms (dobra a cada tentativa). Default: 500. */
  baseBackoffMs?: number;
  /** Função de sleep injetável (para testes). Default: setTimeout. */
  sleep?: SleepFn;
  /** User-Agent padrão enviado em todas as requisições. */
  userAgent?: string;
}

const DEFAULT_SLEEP: SleepFn = (ms) => new Promise((r) => setTimeout(r, ms));
const DEFAULT_ACCEPT =
  'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
const DEFAULT_ACCEPT_LANGUAGE = 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7';

function extractHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function extractSetCookies(headers: Headers): string[] {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const rawEntries =
    typeof getSetCookie === 'function' && getSetCookie.call(headers).length > 0
      ? getSetCookie.call(headers)
      : headers.get('set-cookie')
        ? [headers.get('set-cookie')!]
        : [];
  // Divide múltiplos cookies separados por vírgula (ignorando vírgula em Expires=Wed, ...)
  return rawEntries.flatMap((entry) =>
    entry.split(/,(?=\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=)/),
  );
}

export class Fetcher {
  private readonly transport: FetchTransport;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly sleep: SleepFn;
  private readonly userAgent: string | undefined;
  private readonly cookiesByHost = new Map<string, Map<string, string>>();

  constructor(opts: FetcherOptions = {}) {
    this.transport = opts.transport ?? ((url, init) => fetch(url, init));
    this.maxRetries = opts.maxRetries ?? 3;
    this.baseBackoffMs = opts.baseBackoffMs ?? 500;
    this.sleep = opts.sleep ?? DEFAULT_SLEEP;
    this.userAgent = opts.userAgent;
  }

  private storeCookies(host: string | null, responseHeaders: Headers): void {
    if (!host) return;
    const rawCookies = extractSetCookies(responseHeaders);
    if (rawCookies.length === 0) return;

    let jar = this.cookiesByHost.get(host);
    if (!jar) {
      jar = new Map<string, string>();
      this.cookiesByHost.set(host, jar);
    }

    for (const raw of rawCookies) {
      const firstPart = raw.split(';')[0]?.trim() ?? '';
      const eqIdx = firstPart.indexOf('=');
      if (eqIdx <= 0) continue;
      const name = firstPart.slice(0, eqIdx).trim();
      const val = firstPart.slice(eqIdx + 1).trim();
      if (name) {
        jar.set(name, val);
      }
    }
  }

  private formatCookieHeader(host: string | null): string | null {
    if (!host) return null;
    const jar = this.cookiesByHost.get(host);
    if (!jar || jar.size === 0) return null;
    return Array.from(jar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  async get(url: string, init: RequestInit = {}): Promise<Response> {
    const host = extractHost(url);
    const headers = new Headers(init.headers);
    if (this.userAgent && !headers.has('user-agent')) {
      headers.set('user-agent', this.userAgent);
    }
    if (!headers.has('accept')) {
      headers.set('accept', DEFAULT_ACCEPT);
    }
    if (!headers.has('accept-language')) {
      headers.set('accept-language', DEFAULT_ACCEPT_LANGUAGE);
    }
    if (!headers.has('cookie')) {
      const cookieHeader = this.formatCookieHeader(host);
      if (cookieHeader) {
        headers.set('cookie', cookieHeader);
      }
    }

    let attempt = 0;
    let lastResponse: Response | undefined;

    while (attempt < this.maxRetries) {
      const response = await this.transport(url, { ...init, headers, method: 'GET' });
      this.storeCookies(host, response.headers);
      lastResponse = response;

      if (response.status !== 429 && response.status !== 503) {
        return response;
      }

      // Retry-After pode ser segundos (número) ou data HTTP; aqui tratamos segundos.
      const retryAfter = response.headers.get('retry-after');
      let wait = this.baseBackoffMs * 2 ** attempt;
      if (retryAfter !== null) {
        const secs = Number(retryAfter);
        if (Number.isFinite(secs) && secs >= 0) {
          wait = Math.max(wait, secs * 1000);
        }
      }

      attempt += 1;
      if (attempt >= this.maxRetries) break;
      await this.sleep(wait);
    }

    // Esgotou retries: retorna a última resposta (o chamador decide o que fazer).
    return lastResponse!;
  }
}
