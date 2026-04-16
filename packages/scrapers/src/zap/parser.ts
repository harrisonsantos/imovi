import * as cheerio from 'cheerio';
import type { RawListing } from '@imovi/shared';
import {
  mapOperation,
  mapPropertyType,
  parseArea,
  parseFirstInt,
  parsePriceBRL,
} from '../core/parse-utils.js';

export interface ParseContext {
  sourceUrl: string;
  scrapedAt: Date;
}

/**
 * Parser puro de página de listagem do Zap. Recebe HTML e retorna RawListings.
 * Anúncios sem preço discernível vêm com `price=null, partial=true`.
 */
export function parseZapListingPage(html: string, ctx: ParseContext): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];

  $('.result-card').each((_i, el) => {
    const $el = $(el);
    const id = $el.attr('data-id')?.trim();
    const href = $el.find('a.result-card__link').attr('href')?.trim();
    if (!id || !href) return;

    const title = $el.find('.result-card__title').text().trim() || undefined;
    const addressRaw = $el.find('.result-card__address').text().trim() || undefined;
    const $price = $el.find('.result-card__price');
    const priceText = $price.text().trim();
    const operation = mapOperation($price.attr('data-operation') ?? priceText);
    const price = parsePriceBRL(priceText);

    const area = parseArea($el.find('[data-kind="area"]').text());
    const bedrooms = parseFirstInt($el.find('[data-kind="bedrooms"]').text());
    const bathrooms = parseFirstInt($el.find('[data-kind="bathrooms"]').text());
    const parking = parseFirstInt($el.find('[data-kind="parking"]').text());
    const propertyType = mapPropertyType($el.find('.result-card__property-type').text());

    out.push({
      source: 'zap',
      sourceListingId: id,
      url: href,
      title,
      addressRaw,
      price,
      operation,
      area,
      bedrooms,
      bathrooms,
      parking,
      propertyType,
      scrapedAt: ctx.scrapedAt,
      partial: price === null,
    });
  });

  return out;
}
