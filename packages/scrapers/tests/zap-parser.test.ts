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

  it('mapeia JSON-LD 2026 com @type Product e additionalType', () => {
  const html = `<!doctype html><html><body>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "item": {
          "@type": "Product",
          "additionalType": "https://schema.org/Apartment",
          "@id": "zap-p1",
          "name": "Apartamento em Curitiba",
          "url": "https://www.zapimoveis.com.br/imovel/zap-p1/",
          "address": { "addressLocality": "Curitiba", "addressRegion": "PR" },
          "offers": { "price": 400000 }
        }
      },
      {
        "@type": "ListItem",
        "position": 2,
        "item": {
          "@type": "Product",
          "additionalType": ["https://schema.org/House"],
          "@id": "zap-p2",
          "name": "Casa em Curitiba",
          "url": "https://www.zapimoveis.com.br/imovel/zap-p2/",
          "address": { "addressLocality": "Curitiba", "addressRegion": "PR" },
          "offers": { "price": 800000 }
        }
      },
      {
        "@type": "ListItem",
        "position": 3,
        "item": {
          "@type": "Product",
          "additionalType": "https://schema.org/Landform",
          "@id": "zap-p3",
          "name": "Lote em Curitiba",
          "url": "https://www.zapimoveis.com.br/imovel/zap-p3/",
          "address": { "addressLocality": "Curitiba", "addressRegion": "PR" },
          "offers": { "price": 200000 }
        }
      },
      {
        "@type": "ListItem",
        "position": 4,
        "item": {
          "@type": "Product",
          "additionalType": "https://schema.org/Place",
          "@id": "zap-p4",
          "name": "Cobertura duplex com vista",
          "url": "https://www.zapimoveis.com.br/imovel/cobertura-zap-p4/",
          "address": { "addressLocality": "Curitiba", "addressRegion": "PR" },
          "offers": { "price": 1500000 }
        }
      },
      {
        "@type": "ListItem",
        "position": 5,
        "item": {
          "@type": "Product",
          "@id": "zap-p5",
          "name": "Ponto comercial",
          "url": "https://www.zapimoveis.com.br/imovel/sala-comercial-zap-p5/",
          "address": { "addressLocality": "Curitiba", "addressRegion": "PR" },
          "offers": { "price": 350000 }
        }
      }
    ]
  }
  </script>
  </body></html>`;

    const listings = parseZapListingPage(html, {
      sourceUrl: 'https://www.zapimoveis.com.br/venda/pr/',
      scrapedAt: new Date('2026-04-15T12:00:00Z'),
    });

    expect(listings).toHaveLength(5);
    expect(listings[0]?.propertyType).toBe('apartment');
    expect(listings[1]?.propertyType).toBe('house');
    expect(listings[2]?.propertyType).toBe('land');
    expect(listings[3]?.propertyType).toBe('apartment');
    expect(listings[4]?.propertyType).toBe('commercial');
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
