import { afterEach, describe, expect, it, vi } from 'vitest';
import * as enrichment from '../src/index.js';
import { curitibaResponse } from './fixtures/curitiba.js';

const address = {
  street: 'Rua Sintética',
  number: '10',
  neighborhood: 'Centro',
  city: 'Curitiba',
  state: 'PR',
  cep: '80000-000',
};
const endpoint = 'https://api.infosimples.com/api/v2/consultas/contrato-sintetico';
afterEach(() => vi.unstubAllGlobals());

function setup(body: unknown = curitibaResponse) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Rede proibida');
    }),
  );
  const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body)));
  // Namespace permite observar RED por export ausente antes de criar o adapter.
  const adapter = new enrichment.CuritibaIptuAdapter({
    apiToken: 'token-sintetico',
    endpoint,
    fetchFn,
  });
  return { adapter, fetchFn };
}

describe('CuritibaIptuAdapter (contrato sintético)', () => {
  it('exporta o adapter Curitiba', () => {
    expect(enrichment).toHaveProperty('CuritibaIptuAdapter');
  });

  it('normaliza cadastro, área, valores brasileiros e ano, descartando dados pessoais', async () => {
    const { adapter, fetchFn } = setup();
    const record = await adapter.getIptu(address, 2026);
    expect(record).toEqual({
      source: 'infosimples',
      taxYear: 2026,
      cadastralNumber: '00.0.0000.0000.00-0',
      areaM2: 123.45,
      assessedValue: 456789.12,
      iptuAmount: 1234.56,
      fetchedAt: expect.any(Date),
      rawPayload: {
        cadastralNumber: '00.0.0000.0000.00-0',
        taxYear: 2026,
        areaM2: 123.45,
        assessedValue: 456789.12,
        iptuAmount: 1234.56,
      },
    });
    expect(JSON.stringify(record)).not.toMatch(/PESSOA|CPF|proprietario|detalhes/);
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({ method: 'POST', redirect: 'error' }),
    );
  });

  it.each([
    null,
    {},
    { code: 200, data: [] },
    { code: 600, data: curitibaResponse.data },
    { code: 200, data: [...curitibaResponse.data, ...curitibaResponse.data] },
    { code: 200, data: [{ ...curitibaResponse.data[0], exercicio: 2025 }] },
    { code: 200, data: [{ ...curitibaResponse.data[0], inscricao_imobiliaria: '' }] },
    { code: 200, data: [{ ...curitibaResponse.data[0], valor_venal: '1.2.3' }] },
  ])('não inventa registro para resposta inválida: %j', async (body) => {
    const { adapter } = setup(body);
    expect(await adapter.getIptu(address, 2026)).toBeNull();
  });

  it('mantém valores ausentes como null e aceita número/decimal com ponto', async () => {
    const { adapter } = setup({
      code: 200,
      data: [
        {
          inscricao_imobiliaria: '000',
          exercicio: 2026,
          area_construida: 90.5,
          valor_venal: '123456.78',
        },
      ],
    });
    expect(await adapter.getIptu(address, 2026)).toMatchObject({
      areaM2: 90.5,
      assessedValue: 123456.78,
      iptuAmount: null,
    });
  });

  it('recusa outra cidade sem consultar', async () => {
    const { adapter, fetchFn } = setup();
    expect(await adapter.getIptu({ ...address, city: 'Londrina' }, 2026)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
