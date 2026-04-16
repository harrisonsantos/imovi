import { describe, it, expect } from 'vitest';
import type { NormalizedListing } from '@imovi/shared';
import { dedupe } from '../src/dedupe.js';

function makeListing(overrides: Partial<NormalizedListing> = {}): NormalizedListing {
  return {
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
    ...overrides,
  };
}

describe('dedupe', () => {
  it('duas listagens do mesmo imóvel (áreas 62 e 63) → mesmo cluster', () => {
    const a = makeListing({ area: 62, source: 'zap', sourceListingId: 'zap-a' });
    const b = makeListing({ area: 63, source: 'olx', sourceListingId: 'olx-b' });
    const result = dedupe([a, b]);
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0]?.listings).toHaveLength(2);
  });

  it('variações de abreviação e CEP sem traço → mesmo cluster', () => {
    const olx = makeListing({
      source: 'olx',
      sourceListingId: 'olx-1',
      addressNormalized: {
        street: 'Rua Ibituruna',
        number: '123',
        neighborhood: 'Moema',
        city: 'São Paulo',
        state: 'SP',
        cep: '04037-050',
      },
    });
    const zap = makeListing({
      source: 'zap',
      sourceListingId: 'zap-1',
      addressNormalized: {
        street: 'RUA IBITURUNA',
        number: '123',
        neighborhood: 'Moema',
        city: 'São Paulo',
        state: 'SP',
        cep: '04037050',
      },
    });
    const result = dedupe([olx, zap]);
    expect(result.clusters).toHaveLength(1);
  });

  it('CEPs diferentes → clusters separados', () => {
    const a = makeListing({
      source: 'zap',
      sourceListingId: 'zap-a',
      addressNormalized: {
        street: 'Rua Ibituruna',
        number: '123',
        neighborhood: 'Moema',
        city: 'São Paulo',
        state: 'SP',
        cep: '04037-050',
      },
    });
    const b = makeListing({
      source: 'olx',
      sourceListingId: 'olx-b',
      addressNormalized: {
        street: 'Rua Ibituruna',
        number: '123',
        neighborhood: 'Moema',
        city: 'São Paulo',
        state: 'SP',
        cep: '04038-050',
      },
    });
    const result = dedupe([a, b]);
    expect(result.clusters).toHaveLength(2);
  });

  it('representante do cluster é a listagem com mais campos não-null', () => {
    const incomplete = makeListing({
      source: 'zap',
      sourceListingId: 'zap-incomplete',
      bathrooms: null,
      parking: null,
      title: undefined,
    });
    const complete = makeListing({
      source: 'olx',
      sourceListingId: 'olx-complete',
      bathrooms: 2,
      parking: 2,
      title: 'Apto completo',
      description: 'com tudo',
    });
    const result = dedupe([incomplete, complete]);
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0]?.representative.sourceListingId).toBe('olx-complete');
  });
});
