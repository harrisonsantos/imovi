import * as cheerio from 'cheerio';
import type { RawListing } from '@imovi/shared';
import {
  mapOperation,
  mapPropertyType,
  parseArea,
  parseFirstInt,
  parsePriceBRL,
} from '../core/parse-utils.js';
import type { ParseContext } from '../zap/parser.js';

/** Parser puro de página de listagem da OLX. */
export function parseOlxListingPage(html: string, ctx: ParseContext): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];

  $('.ad-item').each((_i, el) => {
    const $el = $(el);
    const id = $el.attr('data-ad-id')?.trim();
    const href = $el.find('a.ad-item__link').attr('href')?.trim();
    if (!id || !href) return;

    const title = $el.find('.ad-item__title').text().trim() || undefined;
    const addressRaw = $el.find('.ad-item__location').text().trim() || undefined;
    const $price = $el.find('.ad-item__price');
    const priceText = $price.text().trim();
    const operation = mapOperation($price.attr('data-operation') ?? priceText);
    const price = parsePriceBRL(priceText);

    const area = parseArea($el.find('[data-kind="area"]').text());
    const bedrooms = parseFirstInt($el.find('[data-kind="bedrooms"]').text());
    const bathrooms = parseFirstInt($el.find('[data-kind="bathrooms"]').text());
    const parking = parseFirstInt($el.find('[data-kind="parking"]').text());
    const propertyType = mapPropertyType($el.find('.ad-item__property-type').text());

    out.push({
      source: 'olx',
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
