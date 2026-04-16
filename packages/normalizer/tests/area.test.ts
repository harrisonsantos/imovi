import { describe, it, expect } from 'vitest';
import { parseArea } from '../src/parsers/area.js';

describe('parseArea', () => {
  it('parseia "62m²" como 62', () => {
    expect(parseArea('62m²')).toBe(62);
  });

  it('parseia "62 m2" como 62', () => {
    expect(parseArea('62 m2')).toBe(62);
  });

  it('parseia "62,5 m²" como 62.5', () => {
    expect(parseArea('62,5 m²')).toBe(62.5);
  });

  it('parseia "62.5m²" como 62.5', () => {
    expect(parseArea('62.5m²')).toBe(62.5);
  });

  it('parseia "62 metros" como 62', () => {
    expect(parseArea('62 metros')).toBe(62);
  });

  it('retorna null para "lixo"', () => {
    expect(parseArea('lixo')).toBeNull();
  });

  it('retorna null para vazio', () => {
    expect(parseArea('')).toBeNull();
  });
});
