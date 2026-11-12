import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { RawListingSchema } from '@imovi/shared';
import { parseVivaRealListingPage } from '../src/vivareal/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = (p: string) => readFileSync(join(__dirname, '__fixtures__', p), 'utf8');

describe('parseVivaRealListingPage', () => {
  it('extrai 2 RawListings válidos', () => {
    const html = fx('vivareal/listing-page-1.html');
    const listings = parseVivaRealListingPage(html, {
      sourceUrl: 'https://www.vivareal.com.br/aluguel/sp/',
      scrapedAt: new Date('2026-04-15T12:00:00Z'),
    });

    expect(listings).toHaveLength(2);
    for (const l of listings) {
      expect(RawListingSchema.safeParse(l).success).toBe(true);
    }

    expect(listings[0]?.source).toBe('vivareal');
    expect(listings[0]?.sourceListingId).toBe('vr-2001');
    expect(listings[0]?.price).toBe(3500);
    expect(listings[0]?.operation).toBe('rent');
    expect(listings[0]?.propertyType).toBe('apartment');
    expect(listings[1]?.propertyType).toBe('commercial');
  });

  it('mapeia Product + additionalType e bairro via URL quando name termina em "em"', () => {
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
            "additionalType": "https://schema.org/House",
            "@id": "vr-p1",
            "name": "Casa à venda com 3 quartos, 3 suítes, 4 banheiros, 2 vagas na garagem em",
            "url": "https://www.vivareal.com.br/imovel/venda-casa-3-quartos-bigorrilho-curitiba-pr-abc/",
            "address": { "addressLocality": "Curitiba", "addressRegion": "PR" },
            "offers": { "price": 1200000 }
          }
        },
        {
          "@type": "ListItem",
          "position": 2,
          "item": {
            "@type": "Product",
            "additionalType": "https://schema.org/Apartment",
            "@id": "vr-p2",
            "name": "Apartamento com 2 quartos na garagem em",
            "url": "https://www.vivareal.com.br/imovel/casa-2-quartos-venda-agua-verde-bairros-curitiba-pr-xyz/",
            "address": { "addressLocality": "Curitiba", "addressRegion": "PR" },
            "offers": { "price": 450000 }
          }
        }
      ]
    }
    </script>
    <div data-cy="rp-cardProperty-location-txt">Bigorrilho, Curitiba</div>
    </body></html>`;

    const listings = parseVivaRealListingPage(html, {
      sourceUrl: 'https://www.vivareal.com.br/venda/parana/curitiba/',
      scrapedAt: new Date('2026-04-15T12:00:00Z'),
    });

    expect(listings).toHaveLength(2);
    expect(listings[0]?.propertyType).toBe('house');
    expect(listings[0]?.addressRaw).toContain('Bigorrilho');
    expect(listings[1]?.propertyType).toBe('apartment');
    expect(listings[1]?.addressRaw).toMatch(/[Áá]gua Verde|Agua Verde/i);
  });

  it('marca anúncio sem preço como partial e price=null', () => {
    const html = fx('vivareal/listing-partial.html');
    const listings = parseVivaRealListingPage(html, {
      sourceUrl: 'https://www.vivareal.com.br/aluguel/sp/',
      scrapedAt: new Date('2026-04-15T12:00:00Z'),
    });

    expect(listings).toHaveLength(1);
    expect(listings[0]?.price).toBeNull();
    expect(listings[0]?.partial).toBe(true);
    expect(RawListingSchema.safeParse(listings[0]).success).toBe(true);
  });
});
