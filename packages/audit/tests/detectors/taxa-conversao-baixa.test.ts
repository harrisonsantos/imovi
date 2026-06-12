import { describe, expect, it } from 'vitest';
import {
  calcularTaxaConversao,
  detectTaxaConversaoBaixa,
} from '../../src/detectors/taxa-conversao-baixa.js';

describe('calcularTaxaConversao', () => {
  it('deve calcular a taxa em % com 2 casas (matemática portada de patterns.ts)', () => {
    expect(calcularTaxaConversao(3, 9)).toBe(33.33);
    expect(calcularTaxaConversao(1, 2)).toBe(50);
  });

  it('deve retornar 0 quando não há leads', () => {
    expect(calcularTaxaConversao(5, 0)).toBe(0);
  });
});

describe('detectTaxaConversaoBaixa', () => {
  it('deve detectar corretor com conversão < 30% da média global e > 10 leads', () => {
    const stats = [
      // média global ≈ (50 + 50 + 0) / 3 = 33.33; limiar = 10
      { corretorId: 'c1', totalLeads: 20, totalNegocios: 10 }, // 50%
      { corretorId: 'c2', totalLeads: 20, totalNegocios: 10 }, // 50%
      { corretorId: 'c3', totalLeads: 20, totalNegocios: 0 }, // 0% → anômalo
    ];

    const anomalias = detectTaxaConversaoBaixa(stats);

    expect(anomalias).toHaveLength(1);
    const a = anomalias[0]!;
    expect(a.tipo).toBe('taxa_conversao_baixa');
    expect(a.severidade).toBe('alta');
    expect(a.corretorId).toBe('c3');
    expect(a.entidadeTipo).toBe('corretor');
    expect(a.entidadeId).toBe('c3');
    expect(a.dadosContexto.totalLeads).toBe(20);
  });

  it('não deve sinalizar corretor com 10 leads ou menos (mínimo > 10)', () => {
    const stats = [
      { corretorId: 'c1', totalLeads: 20, totalNegocios: 10 },
      { corretorId: 'c2', totalLeads: 10, totalNegocios: 0 }, // poucos leads
    ];

    expect(detectTaxaConversaoBaixa(stats)).toHaveLength(0);
  });

  it('não deve sinalizar quando todas as taxas estão próximas da média', () => {
    const stats = [
      { corretorId: 'c1', totalLeads: 20, totalNegocios: 8 },
      { corretorId: 'c2', totalLeads: 20, totalNegocios: 10 },
    ];

    expect(detectTaxaConversaoBaixa(stats)).toHaveLength(0);
  });

  it('deve retornar vazio para lista vazia', () => {
    expect(detectTaxaConversaoBaixa([])).toHaveLength(0);
  });
});
