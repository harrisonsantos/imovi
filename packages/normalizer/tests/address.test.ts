import { describe, it, expect } from 'vitest';
import { parseAddress } from '../src/parsers/address.js';

describe('parseAddress', () => {
  it('parseia formato completo com CEP formatado', () => {
    const addr = parseAddress('Rua Ibituruna, 123 - Moema, São Paulo/SP - 04037-050');
    expect(addr).not.toBeNull();
    expect(addr?.street).toBe('Rua Ibituruna');
    expect(addr?.number).toBe('123');
    expect(addr?.neighborhood).toBe('Moema');
    expect(addr?.city).toBe('São Paulo');
    expect(addr?.state).toBe('SP');
    expect(addr?.cep).toMatch(/^04037-?050$/);
  });

  it('parseia formato com abreviações e CEP sem traço', () => {
    const addr = parseAddress('R. Ibituruna 123 Moema SP 04037050');
    expect(addr).not.toBeNull();
    expect(addr?.street.toLowerCase()).toContain('ibituruna');
    expect(addr?.number).toBe('123');
    expect(addr?.neighborhood.toLowerCase()).toContain('moema');
    expect(addr?.state).toBe('SP');
    expect(addr?.cep.replace(/-/g, '')).toBe('04037050');
  });

  it('usa fallback quando CEP está ausente', () => {
    const addr = parseAddress('Rua Ibituruna, 123 - Moema, São Paulo/SP', {
      cep: '04037-050',
    });
    expect(addr).not.toBeNull();
    expect(addr?.cep).toBe('04037-050');
    expect(addr?.street).toBe('Rua Ibituruna');
    expect(addr?.neighborhood).toBe('Moema');
  });

  it('retorna null sem CEP disponível (input nem fallback)', () => {
    const addr = parseAddress('Rua Ibituruna, 123 - Moema, São Paulo/SP');
    expect(addr).toBeNull();
  });
});
