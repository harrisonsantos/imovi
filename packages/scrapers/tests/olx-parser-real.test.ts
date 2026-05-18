/**
 * Testes de parser contra HTML real capturado do OLX.
 * Requer fixture local — rode: npx tsx packages/scrapers/scripts/capture-fixtures.ts
 * Em CI o arquivo não existe e os testes são pulados automaticamente.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseOlxListingPage } from '../src/olx/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, '__fixtures__', 'olx', 'real-page-1.html');

describe.skipIf(!existsSync(FIXTURE))('parseOlxListingPage — HTML real', () => {
  function getListings() {
    const html = readFileSync(FIXTURE, 'utf8');
    return parseOlxListingPage(html, {
      sourceUrl: 'https://www.olx.com.br/imoveis/venda/estado-pr/cidade-curitiba?o=1',
      scrapedAt: new Date(),
    });
  }

  it('extrai pelo menos 1 listing do HTML real', () => {
    const listings = getListings();
    expect(listings.length).toBeGreaterThanOrEqual(1);
  });

  it('pelo menos 1 listing tem price não-nulo e area > 0', () => {
    const listings = getListings();
    const valid = listings.filter((l) => l.price !== null && l.area !== null && l.area > 0);
    expect(valid.length, 'Nenhum listing com price+area válidos — seletores provavelmente quebrados').toBeGreaterThanOrEqual(1);
  });

  it('pelo menos 50% dos listings têm price não-nulo', () => {
    const listings = getListings();
    expect(listings.length).toBeGreaterThan(0);
    const withPrice = listings.filter((l) => l.price !== null);
    expect(
      withPrice.length / listings.length,
      `Apenas ${withPrice.length}/${listings.length} com price — parser provavelmente usa seletores errados`,
    ).toBeGreaterThanOrEqual(0.5);
  });

  it('todos os listings retornados têm source=olx e url preenchida', () => {
    const listings = getListings();
    for (const l of listings) {
      expect(l.source).toBe('olx');
      expect(l.url).toMatch(/^https?:\/\//);
    }
  });
});
