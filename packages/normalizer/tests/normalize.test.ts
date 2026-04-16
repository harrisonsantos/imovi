import { describe, it, expect } from 'vitest';
import { NormalizedListingSchema, type RawListing } from '@imovi/shared';
import { normalize } from '../src/normalize.js';

const baseRaw: RawListing = {
  source: 'zap',
  sourceListingId: 'zap-1',
  url: 'https://www.zapimoveis.com.br/imovel/1',
  title: 'Apto Moema',
  description: 'bom apto',
  price: 500_000,
  operation: 'sale',
  addressRaw: 'Rua Ibituruna, 123 - Moema, São Paulo/SP - 04037-050',
  area: 62,
  bedrooms: 2,
  bathrooms: 1,
  parking: 1,
  propertyType: 'apartment',
  scrapedAt: new Date('2026-04-15T12:00:00Z'),
  partial: false,
};

describe('normalize', () => {
  it('RawListing válido → NormalizedListing que passa no schema', () => {
    const result = normalize(baseRaw);
    const parsed = NormalizedListingSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.addressNormalized.cep).toMatch(/^04037-?050$/);
    expect(result.price).toBe(500_000);
    expect(result.area).toBe(62);
  });

  it('RawListing com price null → lança erro', () => {
    expect(() => normalize({ ...baseRaw, price: null })).toThrow(
      /normalização requer preço/i,
    );
  });

  it('RawListing com propertyType null → lança erro', () => {
    expect(() => normalize({ ...baseRaw, propertyType: null })).toThrow();
  });

  it('RawListing com area null → lança erro', () => {
    expect(() => normalize({ ...baseRaw, area: null })).toThrow();
  });
});
