import { describe, expect, it } from 'vitest';
import { detectLeadPerdidoRapido } from '../../src/detectors/lead-perdido-rapido.js';
import { makeLead } from './fixtures.js';

describe('detectLeadPerdidoRapido', () => {
  const agora = new Date('2026-06-11T12:00:00Z');

  it('deve detectar lead perdido em menos de 24h (porta o caso do legado)', () => {
    const criadoHa12h = new Date(agora.getTime() - 12 * 60 * 60 * 1000);
    const lead = makeLead({
      id: 'lead-rapido',
      nome: 'João Silva',
      status: 'perdido',
      corretorId: 'corretor-1',
      createdAt: criadoHa12h,
      updatedAt: agora,
    });

    const anomalias = detectLeadPerdidoRapido([lead], agora);

    expect(anomalias).toHaveLength(1);
    const a = anomalias[0]!;
    expect(a.tipo).toBe('lead_perdido_rapido');
    expect(a.severidade).toBe('media');
    expect(a.corretorId).toBe('corretor-1');
    expect(a.entidadeTipo).toBe('lead');
    expect(a.entidadeId).toBe('lead-rapido');
    expect(a.descricao).toContain('João Silva');
    expect(a.dadosContexto.tempoHoras).toBeCloseTo(12, 1);
  });

  it('não deve sinalizar lead perdido após mais de 24h', () => {
    const criadoHa3Dias = new Date(agora.getTime() - 3 * 24 * 60 * 60 * 1000);
    const lead = makeLead({
      status: 'perdido',
      createdAt: criadoHa3Dias,
      updatedAt: agora,
    });

    expect(detectLeadPerdidoRapido([lead], agora)).toHaveLength(0);
  });

  it('não deve sinalizar leads com outros status', () => {
    const lead = makeLead({
      status: 'novo',
      createdAt: new Date(agora.getTime() - 1 * 60 * 60 * 1000),
      updatedAt: agora,
    });

    expect(detectLeadPerdidoRapido([lead], agora)).toHaveLength(0);
  });

  it('deve usar "sem nome" na descrição quando o lead não tem nome', () => {
    const lead = makeLead({
      nome: null,
      status: 'perdido',
      createdAt: new Date(agora.getTime() - 2 * 60 * 60 * 1000),
      updatedAt: agora,
    });

    const anomalias = detectLeadPerdidoRapido([lead], agora);
    expect(anomalias[0]!.descricao).toContain('sem nome');
  });

  it('deve retornar vazio para lista vazia', () => {
    expect(detectLeadPerdidoRapido([], agora)).toHaveLength(0);
  });
});
