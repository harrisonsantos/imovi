import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { RawListingSchema } from '@imovi/shared';
import { parseZapListingPage } from '../src/zap/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = (p: string) => readFileSync(join(__dirname, '__fixtures__', p), 'utf8');

describe('parseZapListingPage', () => {
  it('extrai 2 RawListings válidos de uma página completa', () => {
    const html = fx('zap/listing-page-1.html');
    const listings = parseZapListingPage(html, {
      sourceUrl: 'https://www.zapimoveis.com.br/venda/sp/',
      scrapedAt: new Date('2026-04-15T12:00:00Z'),
    });

    expect(listings).toHaveLength(2);
    for (const l of listings) {
      const res = RawListingSchema.safeParse(l);
      expect(res.success).toBe(true);
    }

    expect(listings[0]?.source).toBe('zap');
    expect(listings[0]?.sourceListingId).toBe('zap-1001');
    expect(listings[0]?.price).toBe(500_000);
    expect(listings[0]?.operation).toBe('sale');
    expect(listings[0]?.area).toBe(62);
    expect(listings[0]?.bedrooms).toBe(2);
    expect(listings[0]?.bathrooms).toBe(1);
    expect(listings[0]?.parking).toBe(1);
    expect(listings[0]?.propertyType).toBe('apartment');
    expect(listings[0]?.partial).toBe(false);

    expect(listings[1]?.sourceListingId).toBe('zap-1002');
    expect(listings[1]?.price).toBe(1_200_000);
    expect(listings[1]?.propertyType).toBe('house');
  });

  it('marca anúncio sem preço como partial e price=null', () => {
    const html = fx('zap/listing-partial.html');
    const listings = parseZapListingPage(html, {
      sourceUrl: 'https://www.zapimoveis.com.br/venda/sp/',
      scrapedAt: new Date('2026-04-15T12:00:00Z'),
    });

    expect(listings).toHaveLength(1);
    expect(listings[0]?.price).toBeNull();
    expect(listings[0]?.partial).toBe(true);

    const res = RawListingSchema.safeParse(listings[0]);
    expect(res.success).toBe(true);
  });
});
