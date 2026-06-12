/**
 * Testes do módulo Vista — schemas zod e client HTTP puro (fetch mockado).
 * Casos de schema portados do ImobCheck (projeto legado absorvido)/tests/webhook-api.test.ts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { vistaWebhookSchema, vistaImovelSchema } from '../src/vista/types.js';
import { VistaClient } from '../src/vista/client.js';

describe('vistaWebhookSchema', () => {
  it('valida payload de webhook corretamente', () => {
    const validPayload = {
      event_type: 'imovel.criado',
      data: {
        Codigo: '12345',
        Endereco: 'Rua Teste, 123',
        Categoria: 'Apartamento',
        ValorVenda: 500000,
      },
    };
    expect(vistaWebhookSchema.safeParse(validPayload).success).toBe(true);
  });

  it('rejeita event_type desconhecido', () => {
    const invalidPayload = { event_type: 'evento_invalido', data: {} };
    expect(vistaWebhookSchema.safeParse(invalidPayload).success).toBe(false);
  });

  it('rejeita payload sem data', () => {
    expect(vistaWebhookSchema.safeParse({ event_type: 'imovel.criado' }).success).toBe(false);
  });

  it('aceita todos os tipos de eventos válidos', () => {
    const eventTypes = [
      'imovel.criado',
      'imovel.atualizado',
      'lead.criado',
      'lead.atualizado',
      'cliente.criado',
      'cliente.atualizado',
      'negocio.criado',
      'negocio.atualizado',
    ];
    for (const event_type of eventTypes) {
      const result = vistaWebhookSchema.safeParse({ event_type, data: { Codigo: '123' } });
      expect(result.success).toBe(true);
    }
  });
});

describe('vistaImovelSchema', () => {
  it('aceita imóvel completo com corretor aninhado', () => {
    const imovel = {
      Codigo: '777',
      Categoria: 'Casa',
      ValorVenda: 850000,
      Corretor: { Nome: 'João Silva', 'E-mail': 'joao@imob.com', Creci: 'CRECI-123' },
    };
    expect(vistaImovelSchema.safeParse(imovel).success).toBe(true);
  });

  it('exige Codigo', () => {
    expect(vistaImovelSchema.safeParse({ Categoria: 'Casa' }).success).toBe(false);
  });
});

describe('VistaClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lança erro quando apiKey não foi configurada', async () => {
    const client = new VistaClient({ apiKey: '' });
    await expect(client.listarImoveis()).rejects.toThrow(/apiKey/i);
  });

  it('monta a URL com key e pesquisa serializada', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ total: 0, data: [] }), { status: 200 }),
    );
    const client = new VistaClient({ apiKey: 'k123', apiUrl: 'https://api.vista.test' });
    await client.listarImoveis({ filter: { Cidade: 'Curitiba' } });

    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.origin).toBe('https://api.vista.test');
    expect(url.pathname).toBe('/imoveis/listar');
    expect(url.searchParams.get('key')).toBe('k123');
    expect(JSON.parse(url.searchParams.get('pesquisa')!)).toEqual({
      filter: { Cidade: 'Curitiba' },
    });
  });

  it('propaga erro HTTP da API Vista', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('chave inválida', { status: 401 }),
    );
    const client = new VistaClient({ apiKey: 'errada', apiUrl: 'https://api.vista.test' });
    await expect(client.listarImoveis()).rejects.toThrow(/401/);
  });

  it('detalhesImovel usa endpoint de detalhes com o código do imóvel', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ Codigo: '55' }), { status: 200 }),
    );
    const client = new VistaClient({ apiKey: 'k', apiUrl: 'https://api.vista.test' });
    await client.detalhesImovel('55');

    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.pathname).toBe('/imoveis/detalhes');
    expect(url.searchParams.get('imovel')).toBe('55');
  });
});
