/**
 * Client HTTP da API Vista CRM — fetch puro, edge-safe (Workers/edge runtime).
 *
 * Diferente do legado, não lê env nem banco: a config (apiKey/apiUrl) vem
 * sempre do caller — em produção, da org_vista_config decifrada na rota.
 */
import type { VistaPesquisa, VistaResponse } from './types.js';

export interface VistaClientOptions {
  apiKey: string;
  apiUrl?: string;
}

const DEFAULT_API_URL = 'http://sandbox-rest.vistahost.com.br';

export class VistaClient {
  private apiKey: string;
  private apiUrl: string;

  constructor(options: VistaClientOptions) {
    this.apiKey = options.apiKey;
    this.apiUrl = options.apiUrl || DEFAULT_API_URL;
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  setApiUrl(apiUrl: string): void {
    this.apiUrl = apiUrl;
  }

  /** Monta a URL com a key e parâmetros extras, e executa o GET. */
  private async get<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    if (!this.apiKey) {
      throw new Error('VistaClient: apiKey é obrigatória. Configure via constructor ou setApiKey().');
    }

    const url = new URL(`${this.apiUrl}/${endpoint}`);
    url.searchParams.set('key', this.apiKey);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vista API error: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  private pesquisaParams(pesquisa?: VistaPesquisa): Record<string, string> {
    return pesquisa ? { pesquisa: JSON.stringify(pesquisa) } : {};
  }

  async listarImoveis(pesquisa?: VistaPesquisa): Promise<VistaResponse> {
    return this.get<VistaResponse>('imoveis/listar', this.pesquisaParams(pesquisa));
  }

  async detalhesImovel(codigo: string, pesquisa?: VistaPesquisa): Promise<unknown> {
    return this.get<unknown>('imoveis/detalhes', {
      imovel: codigo,
      ...this.pesquisaParams(pesquisa),
    });
  }

  async listarClientes(pesquisa?: VistaPesquisa): Promise<VistaResponse> {
    return this.get<VistaResponse>('clientes/listar', this.pesquisaParams(pesquisa));
  }

  async detalhesCliente(codigo: string, pesquisa?: VistaPesquisa): Promise<unknown> {
    return this.get<unknown>('clientes/detalhes', {
      cliente: codigo,
      ...this.pesquisaParams(pesquisa),
    });
  }

  /** Lista valores possíveis de campos (Vista API específico — não segue schema padrão). */
  async listarConteudo(tipos: string[]): Promise<unknown> {
    return this.get<unknown>('imoveis/listar', {
      pesquisa: JSON.stringify({ listarConteudo: tipos }),
    });
  }
}
