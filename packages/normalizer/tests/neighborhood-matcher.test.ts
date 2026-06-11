import { describe, it, expect } from 'vitest';
import {
  extractNeighborhood,
  matchNeighborhood,
  type NeighborhoodCandidate,
} from '../src/neighborhood-matcher.js';

const CANDIDATES: NeighborhoodCandidate[] = [
  { id: 'n-batel', name: 'Batel' },
  { id: 'n-agua-verde', name: 'Água Verde' },
  { id: 'n-ahu', name: 'Ahú' },
  { id: 'n-centro', name: 'Centro' },
  { id: 'n-santa-felicidade', name: 'Santa Felicidade' },
];

describe('extractNeighborhood', () => {
  it('extrai bairro do formato "Rua X - Bairro, Cidade"', () => {
    expect(extractNeighborhood('Rua Comendador Araújo, 456 - Batel, Curitiba/PR', 'Curitiba')).toBe(
      'Batel',
    );
  });

  it('extrai bairro no início (formato Zap "Bairro - Cidade/UF")', () => {
    expect(extractNeighborhood('Ahú - Curitiba/PR', 'Curitiba')).toBe('Ahú');
  });

  it('extrai bairro com separador vírgula (formato OLX "Bairro, Cidade/UF")', () => {
    expect(extractNeighborhood('Santa Felicidade, Curitiba/PR', 'Curitiba')).toBe(
      'Santa Felicidade',
    );
  });

  it('retorna undefined quando cidade não aparece', () => {
    expect(extractNeighborhood('Rua X - Batel, São Paulo/SP', 'Curitiba')).toBeUndefined();
  });

  it('retorna undefined para string vazia', () => {
    expect(extractNeighborhood('', 'Curitiba')).toBeUndefined();
  });
});

describe('matchNeighborhood', () => {
  it('match exato', () => {
    expect(matchNeighborhood('Batel - Curitiba/PR', 'Curitiba', CANDIDATES)).toBe('n-batel');
  });

  it('match case-insensitive', () => {
    expect(matchNeighborhood('BATEL - Curitiba/PR', 'Curitiba', CANDIDATES)).toBe('n-batel');
  });

  it('match sem acento (agua verde → Água Verde)', () => {
    expect(
      matchNeighborhood('Rua Y - Agua Verde, Curitiba/PR', 'Curitiba', CANDIDATES),
    ).toBe('n-agua-verde');
  });

  it('match com acento extra (Ahu → Ahú)', () => {
    expect(matchNeighborhood('Ahu - Curitiba/PR', 'Curitiba', CANDIDATES)).toBe('n-ahu');
  });

  it('retorna undefined para bairro desconhecido', () => {
    expect(
      matchNeighborhood('Bairro Inexistente - Curitiba/PR', 'Curitiba', CANDIDATES),
    ).toBeUndefined();
  });

  it('retorna undefined quando endereço não é da cidade', () => {
    expect(matchNeighborhood('Batel - São Paulo/SP', 'Curitiba', CANDIDATES)).toBeUndefined();
  });

  it('lista de candidatos vazia → undefined', () => {
    expect(matchNeighborhood('Batel - Curitiba/PR', 'Curitiba', [])).toBeUndefined();
  });
});
