import { describe, it, expect } from 'vitest';
import { computeFingerprint, type NormalizedListing } from '../src/index.js';

const baseListing: NormalizedListing = {
  source: 'zap',
  sourceListingId: 'zap-1',
  url: 'https://www.zapimoveis.com.br/imovel/1',
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

describe('computeFingerprint', () => {
  it('é determinístico: mesma entrada → mesmo hash', () => {
    const a = computeFingerprint(baseListing);
    const b = computeFingerprint(baseListing);
    expect(a).toBe(b);
  });

  it('é estável a ±1m² de variação em área', () => {
    const a = computeFingerprint({ ...baseListing, area: 62 });
    const b = computeFingerprint({ ...baseListing, area: 62.4 });
    const c = computeFingerprint({ ...baseListing, area: 61.6 });
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it('difere quando CEP muda', () => {
    const a = computeFingerprint(baseListing);
    const b = computeFingerprint({
      ...baseListing,
      addressNormalized: { ...baseListing.addressNormalized, cep: '04038-050' },
    });
    expect(a).not.toBe(b);
  });

  it('difere quando tipo de imóvel muda', () => {
    const a = computeFingerprint(baseListing);
    const b = computeFingerprint({ ...baseListing, propertyType: 'house' });
    expect(a).not.toBe(b);
  });

  it('difere quando número de quartos muda', () => {
    const a = computeFingerprint(baseListing);
    const b = computeFingerprint({ ...baseListing, bedrooms: 3 });
    expect(a).not.toBe(b);
  });

  it('é case-insensitive no nome da rua', () => {
    const a = computeFingerprint(baseListing);
    const b = computeFingerprint({
      ...baseListing,
      addressNormalized: { ...baseListing.addressNormalized, street: 'RUA IBITURUNA' },
    });
    expect(a).toBe(b);
  });

  it('ignora traço no CEP', () => {
    const a = computeFingerprint(baseListing);
    const b = computeFingerprint({
      ...baseListing,
      addressNormalized: { ...baseListing.addressNormalized, cep: '04037050' },
    });
    expect(a).toBe(b);
  });

  it('produz hash de 32 caracteres', () => {
    expect(computeFingerprint(baseListing)).toHaveLength(32);
  });

  it('é estável a variação de whitespace no nome da rua', () => {
    const a = computeFingerprint(baseListing);
    const b = computeFingerprint({
      ...baseListing,
      addressNormalized: { ...baseListing.addressNormalized, street: '  Rua   Ibituruna  ' },
    });
    expect(a).toBe(b);
  });
});
