import { describe, expect, it } from 'vitest';
import { detectDesvioAvm, type NeighborhoodRef } from '../../src/detectors/desvio-avm.js';
import { makeImovel, makeNegocio } from './fixtures.js';

describe('detectDesvioAvm', () => {
  const bairros: NeighborhoodRef[] = [
    { name: 'Batel', city: 'Curitiba', state: 'PR', medianPriceM2: '10000.00' },
    { name: 'Centro', city: 'Curitiba', state: 'PR', medianPriceM2: 6000 },
    { name: 'Sem Mediana', city: 'Curitiba', state: 'PR', medianPriceM2: null },
  ];
  const opts = { deviationPct: 25 };

  /** Caso base: imóvel com área conhecida → estimativa = mediana × área. */
  const imovelBatel = makeImovel({
    id: 'imovel-batel',
    endereco: 'Av. do Batel, 1000 - Batel, Curitiba/PR',
    valor: '500000.00',
  });

  it('não deve sinalizar desvio abaixo do limiar', () => {
    // estimativa = 10000 * 50 = 500k; venda 450k → desvio 10% < 25%
    const item = {
      negocio: makeNegocio({ imovelId: 'imovel-batel', valorVenda: '450000.00' }),
      imovel: imovelBatel,
      areaM2: 50,
    };

    expect(detectDesvioAvm([item], bairros, opts)).toHaveLength(0);
  });

  it('deve sinalizar com severidade media acima do limiar (sem subfaturamento forte)', () => {
    // estimativa = 500k; venda 350k → desvio 30% > 25%, mas 350k > 60% de 500k
    const item = {
      negocio: makeNegocio({ id: 'neg-medio', imovelId: 'imovel-batel', valorVenda: '350000.00' }),
      imovel: imovelBatel,
      areaM2: 50,
    };

    const anomalias = detectDesvioAvm([item], bairros, opts);

    expect(anomalias).toHaveLength(1);
    const a = anomalias[0]!;
    expect(a.tipo).toBe('desvio_avm');
    expect(a.severidade).toBe('media');
    expect(a.entidadeTipo).toBe('negocio');
    expect(a.entidadeId).toBe('neg-medio');
    expect(a.dadosContexto).toMatchObject({
      estimate: 500000,
      valorVenda: 350000,
      bairro: 'Batel',
    });
    expect(a.dadosContexto.desvioPct).toBeCloseTo(30, 1);
  });

  it('deve sinalizar com severidade alta quando venda > 40% abaixo da estimativa (possível subfaturamento)', () => {
    // estimativa = 500k; venda 250k → 50% abaixo → alta
    const item = {
      negocio: makeNegocio({ id: 'neg-alto', imovelId: 'imovel-batel', valorVenda: '250000.00' }),
      imovel: imovelBatel,
      areaM2: 50,
    };

    const anomalias = detectDesvioAvm([item], bairros, opts);

    expect(anomalias).toHaveLength(1);
    expect(anomalias[0]!.severidade).toBe('alta');
  });

  it('deve sinalizar desvio para cima (sobrevalorização) com severidade media', () => {
    // estimativa = 500k; venda 700k → desvio 40% acima → media
    const item = {
      negocio: makeNegocio({ imovelId: 'imovel-batel', valorVenda: '700000.00' }),
      imovel: imovelBatel,
      areaM2: 50,
    };

    const anomalias = detectDesvioAvm([item], bairros, opts);
    expect(anomalias).toHaveLength(1);
    expect(anomalias[0]!.severidade).toBe('media');
  });

  it('deve casar o bairro de forma case/acento-insensível', () => {
    const imovel = makeImovel({ endereco: 'rua xv, CÉNTRO, curitiba' });
    // fallback sem área: estimativa = valor de anúncio (400k); venda 200k → 50% → alta
    const item = {
      negocio: makeNegocio({ valorVenda: '200000.00' }),
      imovel: { ...imovel, valor: '400000.00' },
    };

    const anomalias = detectDesvioAvm([item], bairros, opts);
    expect(anomalias).toHaveLength(1);
    expect(anomalias[0]!.dadosContexto.bairro).toBe('Centro');
    expect(anomalias[0]!.dadosContexto.estimate).toBe(400000);
  });

  it('deve pular negócio sem imóvel relacionado', () => {
    const item = { negocio: makeNegocio({ valorVenda: '100000.00' }), imovel: null };

    expect(detectDesvioAvm([item], bairros, opts)).toHaveLength(0);
  });

  it('deve pular negócio sem valor de venda', () => {
    const item = { negocio: makeNegocio({ valorVenda: null }), imovel: imovelBatel, areaM2: 50 };

    expect(detectDesvioAvm([item], bairros, opts)).toHaveLength(0);
  });

  it('deve pular imóvel sem bairro correspondente no AVM', () => {
    const imovel = makeImovel({ endereco: 'Rua Qualquer, Bairro Desconhecido', valor: '500000.00' });
    const item = { negocio: makeNegocio({ valorVenda: '100000.00' }), imovel };

    expect(detectDesvioAvm([item], bairros, opts)).toHaveLength(0);
  });

  it('deve pular bairro sem mediana de preço/m²', () => {
    const imovel = makeImovel({ endereco: 'Rua A, Sem Mediana, Curitiba', valor: '500000.00' });
    const item = { negocio: makeNegocio({ valorVenda: '100000.00' }), imovel };

    expect(detectDesvioAvm([item], bairros, opts)).toHaveLength(0);
  });

  it('deve pular quando não há área nem valor de anúncio (sem base de estimativa)', () => {
    const imovel = makeImovel({ endereco: 'Rua B, Batel, Curitiba', valor: null });
    const item = { negocio: makeNegocio({ valorVenda: '100000.00' }), imovel };

    expect(detectDesvioAvm([item], bairros, opts)).toHaveLength(0);
  });
});
