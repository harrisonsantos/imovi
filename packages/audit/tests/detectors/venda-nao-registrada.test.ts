import { describe, expect, it } from 'vitest';
import { detectVendaNaoRegistrada } from '../../src/detectors/venda-nao-registrada.js';
import { makeImovel, makeNegocio } from './fixtures.js';

describe('detectVendaNaoRegistrada', () => {
  it('deve detectar imóvel vendido sem negócio registrado (porta o caso do legado)', () => {
    const imovel = makeImovel({
      id: 'imovel-1',
      endereco: 'Rua Teste, 123',
      corretorId: 'corretor-1',
      vistaId: 'V123',
      status: 'vendido',
    });

    const anomalias = detectVendaNaoRegistrada([imovel], []);

    expect(anomalias).toHaveLength(1);
    const a = anomalias[0]!;
    expect(a.tipo).toBe('venda_nao_registrada');
    expect(a.severidade).toBe('alta');
    expect(a.corretorId).toBe('corretor-1');
    expect(a.entidadeTipo).toBe('imovel');
    expect(a.entidadeId).toBe('imovel-1');
    expect(a.descricao).toContain('Rua Teste, 123');
  });

  it('não deve sinalizar imóvel vendido com negócio correspondente', () => {
    const imovel = makeImovel({ id: 'imovel-1', status: 'vendido' });
    const negocio = makeNegocio({ imovelId: 'imovel-1' });

    expect(detectVendaNaoRegistrada([imovel], [negocio])).toHaveLength(0);
  });

  it('não deve sinalizar imóveis com status diferente de vendido', () => {
    const imovel = makeImovel({ status: 'disponivel' });

    expect(detectVendaNaoRegistrada([imovel], [])).toHaveLength(0);
  });

  it('deve usar vista_id na descrição quando o imóvel não tem endereço', () => {
    const imovel = makeImovel({ endereco: null, vistaId: 'V999', status: 'vendido' });

    const anomalias = detectVendaNaoRegistrada([imovel], []);
    expect(anomalias[0]!.descricao).toContain('V999');
  });
});
