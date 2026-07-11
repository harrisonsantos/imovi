import { describe, expect, it } from 'vitest';
import { safeJsonLd, seoSlug } from '../src/lib/seo';

describe('seoSlug', () => {
  it('gera URL estável sem acentos', () => {
    expect(seoSlug('Água Verde')).toBe('agua-verde');
    expect(seoSlug('São João d’Aliança')).toBe('sao-joao-d-alianca');
  });
});

describe('safeJsonLd', () => {
  it('escapa tags para não encerrar o script JSON-LD', () => {
    expect(safeJsonLd({ value: '</script>' })).not.toContain('<');
    expect(safeJsonLd({ value: '</script>' })).toContain('\\u003c/script>');
  });
});
