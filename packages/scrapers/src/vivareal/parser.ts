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

/** Parser puro de página de listagem do VivaReal. */
export function parseVivaRealListingPage(html: string, ctx: ParseContext): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];

  $('.property-card').each((_i, el) => {
    const $el = $(el);
    const id = $el.attr('data-listing-id')?.trim();
    const href = $el.find('a.property-card__link').attr('href')?.trim();
    if (!id || !href) return;

    const title = $el.find('.property-card__title').text().trim() || undefined;
    const addressRaw = $el.find('.property-card__address').text().trim() || undefined;
    const $price = $el.find('.property-card__price');
    const priceText = $price.text().trim();
    const operation = mapOperation($price.attr('data-operation') ?? priceText);
    const price = parsePriceBRL(priceText);

    const area = parseArea($el.find('[data-kind="area"]').text());
    const bedrooms = parseFirstInt($el.find('[data-kind="bedrooms"]').text());
    const bathrooms = parseFirstInt($el.find('[data-kind="bathrooms"]').text());
    const parking = parseFirstInt($el.find('[data-kind="parking"]').text());
    const propertyType = mapPropertyType($el.find('.property-card__type').text());

    out.push({
      source: 'vivareal',
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
