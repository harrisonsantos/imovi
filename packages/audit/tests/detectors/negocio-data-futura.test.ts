import { describe, expect, it } from 'vitest';
import { detectNegocioDataFutura } from '../../src/detectors/negocio-data-futura.js';
import { makeNegocio } from './fixtures.js';

describe('detectNegocioDataFutura', () => {
  const hoje = new Date('2026-06-11T12:00:00Z');
  const dias = (n: number) => new Date(hoje.getTime() + n * 24 * 60 * 60 * 1000);

  it('deve detectar negócio com data de fechamento futura (porta o caso do legado)', () => {
    const negocio = makeNegocio({
      id: 'negocio-1',
      corretorId: 'corretor-1',
      valorVenda: '500000.00',
      dataFechamento: dias(7),
    });

    const anomalias = detectNegocioDataFutura([negocio], hoje);

    expect(anomalias).toHaveLength(1);
    const a = anomalias[0]!;
    expect(a.tipo).toBe('negocio_data_futura');
    expect(a.severidade).toBe('media');
    expect(a.corretorId).toBe('corretor-1');
    expect(a.entidadeTipo).toBe('negocio');
    expect(a.entidadeId).toBe('negocio-1');
    expect(a.dadosContexto.valorVenda).toBe('500000.00');
  });

  it('não deve sinalizar negócio com data de fechamento passada', () => {
    const negocio = makeNegocio({ dataFechamento: dias(-7) });

    expect(detectNegocioDataFutura([negocio], hoje)).toHaveLength(0);
  });

  it('não deve sinalizar negócio sem data de fechamento', () => {
    const negocio = makeNegocio({ dataFechamento: null });

    expect(detectNegocioDataFutura([negocio], hoje)).toHaveLength(0);
  });
});
