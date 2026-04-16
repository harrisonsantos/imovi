import type { NormalizedListing } from '@imovi/shared';

export function makeNormalizedListing(
  overrides: Partial<NormalizedListing> = {},
): NormalizedListing {
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
