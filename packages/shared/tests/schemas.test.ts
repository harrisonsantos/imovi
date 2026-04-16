import { describe, it, expect } from 'vitest';
import { NormalizedListingSchema, RawListingSchema, type NormalizedListing } from '../src/index.js';

const validNormalized: NormalizedListing = {
  source: 'zap',
  sourceListingId: 'zap-123',
  url: 'https://www.zapimoveis.com.br/imovel/123',
  operation: 'sale',
  price: 500_000,
  area: 62,
  bedrooms: 2,
  bathrooms: 1,
  parking: 1,
  propertyType: 'apartment',
  scrapedAt: new Date('2026-04-15T12:00:00Z'),
  partial: false,
  addressNormalized: {
    street: 'Rua Ibituruna',
    number: '123',
    neighborhood: 'Moema',
    city: 'São Paulo',
    state: 'SP',
    cep: '04037-050',
  },
};

describe('NormalizedListingSchema', () => {
  it('accepts a valid payload', () => {
    const result = NormalizedListingSchema.safeParse(validNormalized);
    expect(result.success).toBe(true);
  });

  it('rejects negative price', () => {
    const result = NormalizedListingSchema.safeParse({ ...validNormalized, price: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects zero price', () => {
    const result = NormalizedListingSchema.safeParse({ ...validNormalized, price: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects zero area', () => {
    const result = NormalizedListingSchema.safeParse({ ...validNormalized, area: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects UF com mais de 2 caracteres', () => {
    const result = NormalizedListingSchema.safeParse({
      ...validNormalized,
      addressNormalized: { ...validNormalized.addressNormalized, state: 'SAO' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects UF com lowercase', () => {
    const result = NormalizedListingSchema.safeParse({
      ...validNormalized,
      addressNormalized: { ...validNormalized.addressNormalized, state: 'sp' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects CEP inválido', () => {
    const result = NormalizedListingSchema.safeParse({
      ...validNormalized,
      addressNormalized: { ...validNormalized.addressNormalized, cep: 'abcdefg' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts CEP sem traço', () => {
    const result = NormalizedListingSchema.safeParse({
      ...validNormalized,
      addressNormalized: { ...validNormalized.addressNormalized, cep: '04037050' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects URL malformada', () => {
    const result = NormalizedListingSchema.safeParse({ ...validNormalized, url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects source fora do enum', () => {
    const result = NormalizedListingSchema.safeParse({ ...validNormalized, source: 'imovelweb' });
    expect(result.success).toBe(false);
  });
});

describe('RawListingSchema', () => {
  it('accepts partial listing com preço null', () => {
    const result = RawListingSchema.safeParse({
      source: 'olx',
      sourceListingId: 'olx-1',
      url: 'https://www.olx.com.br/imovel/1',
      operation: 'sale',
      price: null,
      area: null,
      bedrooms: null,
      bathrooms: null,
      parking: null,
      propertyType: null,
      scrapedAt: new Date('2026-04-15T12:00:00Z'),
      partial: true,
    });
    expect(result.success).toBe(true);
  });

  it('aplica default partial=false quando omitido', () => {
    const result = RawListingSchema.safeParse({
      source: 'zap',
      sourceListingId: 'zap-xyz',
      url: 'https://www.zapimoveis.com.br/imovel/xyz',
      operation: 'rent',
      price: 3500,
      area: 45,
      bedrooms: 1,
      bathrooms: 1,
      parking: 0,
      propertyType: 'apartment',
      scrapedAt: new Date('2026-04-15T12:00:00Z'),
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.partial).toBe(false);
  });
});
