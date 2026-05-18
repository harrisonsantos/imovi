import { describe, it, expect } from 'vitest';
import {
  getCuritibaCepFallback,
  CURITIBA_CEP_BY_NEIGHBORHOOD,
} from '../src/parsers/cep-fallback.js';

describe('getCuritibaCepFallback', () => {
  it('retorna CEP para bairro bem grafado', () => {
    expect(getCuritibaCepFallback('Rua X, 123 - Batel, Curitiba/PR')).toBe('80420-000');
  });

  it('retorna CEP para bairro com acento (Água Verde)', () => {
    expect(getCuritibaCepFallback('Av. Y, 456 - Água Verde, Curitiba/PR')).toBe('80620-010');
  });

  it('retorna CEP para bairro sem acento (agua verde)', () => {
    expect(getCuritibaCepFallback('Av. Y, 456 - Agua Verde, Curitiba/PR')).toBe('80620-010');
  });

  it('retorna CEP para bairro com hífen como separador', () => {
    expect(getCuritibaCepFallback('Rua Z - Centro - Curitiba/PR')).toBe('80010-010');
  });

  it('retorna CEP do centro para bairro fora do mapa (generic Curitiba fallback)', () => {
    expect(getCuritibaCepFallback('Rua X - BairroDesconhecido, Curitiba/PR')).toBe('80010-010');
  });

  it('retorna CEP quando bairro está no início (sem separador antes)', () => {
    expect(getCuritibaCepFallback('Ahú - Curitiba/PR')).toBe('80540-140');
  });

  it('retorna CEP quando bairro no início sem acento (ahu)', () => {
    expect(getCuritibaCepFallback('Ahu - Curitiba/PR')).toBe('80540-140');
  });

  it('retorna undefined para endereço sem Curitiba', () => {
    expect(getCuritibaCepFallback('Rua X - Batel, São Paulo/SP')).toBeUndefined();
  });

  it('CURITIBA_CEP_BY_NEIGHBORHOOD cobre todos os 21 bairros do seed', () => {
    const seedBairros = [
      'batel', 'champagnat', 'jardim social', 'bigorrilho', 'hugo lange',
      'alto da xv', 'cabral', 'água verde', 'são francisco', 'juvevê',
      'mercês', 'ahú', 'rebouças', 'cristo rei', 'boa vista',
      'santa felicidade', 'centro', 'portão', 'boqueirão', 'pinheirinho', 'cajuru',
    ];
    for (const bairro of seedBairros) {
      const key = bairro.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const found = CURITIBA_CEP_BY_NEIGHBORHOOD[bairro] ?? CURITIBA_CEP_BY_NEIGHBORHOOD[key];
      expect(found, `CEP ausente para bairro: ${bairro}`).toBeDefined();
    }
  });
});
