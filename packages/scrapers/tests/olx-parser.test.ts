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

  it('extrai anúncios de payloads RSC self.__next_f.push sem __NEXT_DATA__', () => {
    const adsJson =
      '"ads":[{"listId":901,"subject":"Apartamento Água Verde","priceValue":"R$ 380.000","friendlyUrl":"https://www.olx.com.br/d/901","location":"Curitiba, Água Verde","properties":[{"name":"real_estate_type","value":"Venda - Apartamento"},{"name":"size","value":"72 m²"},{"name":"rooms","value":"2 quartos"},{"name":"bathrooms","value":"1 banheiro"},{"name":"garage_spaces","value":"1 vaga"}]},{"listId":902,"subject":"Terreno Batel","priceValue":"R$ 250.000","url":"https://www.olx.com.br/d/902","locationDetails":{"municipality":"Curitiba","neighbourhood":"Batel"},"categoryName":"Terrenos","properties":[{"name":"real_estate_type","value":"Venda - Terreno"},{"name":"size","value":"300 m²"}]}]';
    const chunk = adsJson.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const html = `<!doctype html><html><body>
    <script>self.__next_f.push([1,"${chunk}"])</script>
    </body></html>`;

    const listings = parseOlxListingPage(html, {
      sourceUrl: 'https://www.olx.com.br/imoveis/venda/estado-parana/curitiba',
      scrapedAt: new Date('2026-04-15T12:00:00Z'),
    });

    expect(listings).toHaveLength(2);
    expect(RawListingSchema.safeParse(listings[0]).success).toBe(true);
    expect(listings[0]?.sourceListingId).toBe('901');
    expect(listings[0]?.propertyType).toBe('apartment');
    expect(listings[0]?.addressRaw).toContain('Água Verde');
    expect(listings[1]?.sourceListingId).toBe('902');
    expect(listings[1]?.propertyType).toBe('land');
    expect(listings[1]?.addressRaw).toContain('Batel');
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
