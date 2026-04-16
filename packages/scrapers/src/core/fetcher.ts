/**
 * Camada HTTP injetável com retry exponencial e respeito ao header Retry-After
 * em respostas 429/503.
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

export class Fetcher {
  private readonly transport: FetchTransport;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly sleep: SleepFn;
  private readonly userAgent: string | undefined;

  constructor(opts: FetcherOptions = {}) {
    this.transport = opts.transport ?? ((url, init) => fetch(url, init));
    this.maxRetries = opts.maxRetries ?? 3;
    this.baseBackoffMs = opts.baseBackoffMs ?? 500;
    this.sleep = opts.sleep ?? DEFAULT_SLEEP;
    this.userAgent = opts.userAgent;
  }

  async get(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.userAgent && !headers.has('user-agent')) {
      headers.set('user-agent', this.userAgent);
    }

    let attempt = 0;
    let lastResponse: Response | undefined;

    while (attempt < this.maxRetries) {
      const response = await this.transport(url, { ...init, headers, method: 'GET' });
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
