import type { NormalizedAddress } from '@imovi/shared';
import { IptuRecordSchema, type IptuRecord } from '../types.js';
import { noopLogger, type Logger } from '../logger.js';

/** Config para instanciar o adapter da InfoSimples. */
export interface InfoSimplesConfig {
  apiToken: string;
  /** Endpoint base — default é o consulta de valor venal de SP. */
  endpoint?: string;
  /** Timeout em ms (default 10s). */
  timeoutMs?: number;
  /** Logger opcional. */
  logger?: Logger;
  /** fetch injetável para testes. Default: global fetch. */
  fetchFn?: typeof fetch;
}

const DEFAULT_ENDPOINT =
  'https://api.infosimples.com/api/v2/consultas/pref-sp-sao-paulo-valor-ref';
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Adapter para a API paga InfoSimples (consulta de valor venal / IPTU SP).
 * Errors são convertidos em `null` — o caller decide fallback.
 */
export class InfoSimplesAdapter {
  private readonly token: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly logger: Logger;
  private readonly fetchFn: typeof fetch;

  constructor(config: InfoSimplesConfig) {
    this.token = config.apiToken;
    this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.logger = config.logger ?? noopLogger;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    this.fetchFn = config.fetchFn ?? globalThis.fetch;
  }

  /**
   * Consulta IPTU para um endereço normalizado e ano fiscal.
   * Retorna `IptuRecord` em sucesso, ou `null` em qualquer falha
   * (rate limit 429, timeout, JSON malformado, schema inválido, etc.).
   */
  async getIptu(
    address: NormalizedAddress,
    taxYear: number,
  ): Promise<IptuRecord | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchFn(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          cep: address.cep,
          numero: address.number,
          exercicio: taxYear,
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        this.logger.warn('infosimples: rate limited (429)', {
          cep: address.cep,
        });
        return null;
      }

      if (!response.ok) {
        this.logger.warn('infosimples: HTTP error', {
          status: response.status,
        });
        return null;
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch (err) {
        this.logger.error('infosimples: JSON malformado', {
          error: (err as Error).message,
        });
        return null;
      }

      const mapped = this.mapResponse(json, taxYear);
      const parsed = IptuRecordSchema.safeParse(mapped);
      if (!parsed.success) {
        this.logger.error('infosimples: resposta falhou validação', {
          issues: parsed.error.issues,
        });
        return null;
      }
      return parsed.data;
    } catch (err) {
      const e = err as Error;
      if (e.name === 'AbortError') {
        this.logger.warn('infosimples: timeout', { timeoutMs: this.timeoutMs });
        return null;
      }
      this.logger.error('infosimples: erro inesperado', { error: e.message });
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Mapeia a resposta bruta da InfoSimples para `IptuRecord`.
   * Formato esperado (exemplo):
   * { data: [{ valor_venal: "123456.78", iptu_valor_total: "987.65",
   *   numero_cadastro: "...", exercicio: 2026 }] }
   */
  private mapResponse(json: unknown, taxYear: number): Partial<IptuRecord> {
    const root = json as {
      data?: Array<{
        valor_venal?: string | number | null;
        iptu_valor_total?: string | number | null;
        numero_cadastro?: string;
        exercicio?: number;
      }>;
    };
    const first = root.data?.[0];
    const assessed = toNumberOrNull(first?.valor_venal);
    const iptu = toNumberOrNull(first?.iptu_valor_total);

    return {
      source: 'infosimples',
      taxYear: first?.exercicio ?? taxYear,
      assessedValue: assessed,
      iptuAmount: iptu,
      cadastralNumber: first?.numero_cadastro,
      rawPayload: json,
      fetchedAt: new Date(),
    };
  }
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
