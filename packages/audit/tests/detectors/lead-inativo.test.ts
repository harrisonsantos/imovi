import { describe, expect, it } from 'vitest';
import { detectLeadInativo } from '../../src/detectors/lead-inativo.js';
import { makeLead } from './fixtures.js';

describe('detectLeadInativo', () => {
  const agora = new Date('2026-06-11T12:00:00Z');
  const dias = (n: number) => new Date(agora.getTime() - n * 24 * 60 * 60 * 1000);

  it('deve detectar lead sem atualização há mais de 30 dias (porta o caso do legado)', () => {
    const lead = makeLead({
      id: 'lead-antigo',
      nome: 'Lead Antigo',
      status: 'novo',
      corretorId: 'corretor-1',
      createdAt: dias(40),
      updatedAt: dias(35),
    });

    const anomalias = detectLeadInativo([lead], agora);

    expect(anomalias).toHaveLength(1);
    const a = anomalias[0]!;
    expect(a.tipo).toBe('lead_inativo');
    expect(a.severidade).toBe('baixa');
    expect(a.corretorId).toBe('corretor-1');
    expect(a.entidadeTipo).toBe('lead');
    expect(a.entidadeId).toBe('lead-antigo');
    expect(a.dadosContexto.diasInativo).toBe(35);
  });

  it('deve considerar leads com status contatado', () => {
    const lead = makeLead({ status: 'contatado', updatedAt: dias(45) });

    expect(detectLeadInativo([lead], agora)).toHaveLength(1);
  });

  it('não deve sinalizar lead atualizado há menos de 30 dias', () => {
    const lead = makeLead({ status: 'novo', updatedAt: dias(10) });

    expect(detectLeadInativo([lead], agora)).toHaveLength(0);
  });

  it('não deve sinalizar leads em status finais (perdido/convertido)', () => {
    const perdido = makeLead({ status: 'perdido', updatedAt: dias(60) });
    const convertido = makeLead({ status: 'convertido', updatedAt: dias(60) });

    expect(detectLeadInativo([perdido, convertido], agora)).toHaveLength(0);
  });
});
