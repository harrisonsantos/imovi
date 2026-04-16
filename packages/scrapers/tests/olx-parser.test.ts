import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { RawListingSchema } from '@imovi/shared';
import { parseOlxListingPage } from '../src/olx/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = (p: string) => readFileSync(join(__dirname, '__fixtures__', p), 'utf8');

describe('parseOlxListingPage', () => {
  it('extrai 2 RawListings válidos', () => {
    const html = fx('olx/listing-page-1.html');
    const listings = parseOlxListingPage(html, {
      sourceUrl: 'https://www.olx.com.br/imoveis/sp',
      scrapedAt: new Date('2026-04-15T12:00:00Z'),
    });

    expect(listings).toHaveLength(2);
    for (const l of listings) {
      expect(RawListingSchema.safeParse(l).success).toBe(true);
    }

    expect(listings[0]?.source).toBe('olx');
    expect(listings[0]?.sourceListingId).toBe('olx-3001');
    expect(listings[0]?.price).toBe(420_000);
    expect(listings[0]?.operation).toBe('sale');
    expect(listings[0]?.propertyType).toBe('apartment');
    expect(listings[1]?.propertyType).toBe('land');
  });

  it('marca anúncio sem preço como partial e price=null', () => {
    const html = fx('olx/listing-partial.html');
    const listings = parseOlxListingPage(html, {
      sourceUrl: 'https://www.olx.com.br/imoveis/sp',
      scrapedAt: new Date('2026-04-15T12:00:00Z'),
    });

    expect(listings).toHaveLength(1);
    expect(listings[0]?.price).toBeNull();
    expect(listings[0]?.partial).toBe(true);
    expect(RawListingSchema.safeParse(listings[0]).success).toBe(true);
  });
});
