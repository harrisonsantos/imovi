import { describe, it, expect } from 'vitest';
import { parsePrice } from '../src/parsers/price.js';

describe('parsePrice', () => {
  it('parseia "R$ 1.250.000,00" como 1_250_000', () => {
    expect(parsePrice('R$ 1.250.000,00')).toBe(1_250_000);
  });

  it('parseia "R$ 500.000" como 500_000', () => {
    expect(parsePrice('R$ 500.000')).toBe(500_000);
  });

  it('parseia "1250000" como 1_250_000', () => {
    expect(parsePrice('1250000')).toBe(1_250_000);
  });

  it('parseia "R$ 3.500,00/mês" como 3_500', () => {
    expect(parsePrice('R$ 3.500,00/mês')).toBe(3_500);
  });

  it('retorna null para "Consulte" ou vazio', () => {
    expect(parsePrice('Consulte')).toBeNull();
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('   ')).toBeNull();
  });

  it('retorna null para "R$ 0" (zero inválido)', () => {
    expect(parsePrice('R$ 0')).toBeNull();
    expect(parsePrice('0')).toBeNull();
    expect(parsePrice('R$ 0,00')).toBeNull();
  });
});
