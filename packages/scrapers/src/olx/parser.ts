import type { PropertyType, Operation, RawListing } from '@imovi/shared';
import { parsePriceBRL, parseArea, parseFirstInt } from '../core/parse-utils.js';
import type { ParseContext } from '../zap/parser.js';

interface OlxProperty {
  name: string;
  value: string;
}

interface OlxAd {
  listId: string | number;
  subject?: string;
  priceValue?: string | null;
  price?: string | null;
  friendlyUrl?: string;
  url?: string;
  location?: string;
  categoryName?: string;
  properties?: OlxProperty[];
}

interface NextData {
  props?: { pageProps?: { ads?: OlxAd[] } };
}

function getProp(props: OlxProperty[], name: string): string | undefined {
  return props.find((p) => p.name === name)?.value;
}

function mapOlxType(categoryName: string | undefined, realEstateType: string | undefined): PropertyType | null {
  const cat = (categoryName ?? '').toLowerCase();
  if (cat.includes('apart') || cat.includes('studio') || cat.includes('cobertura')) return 'apartment';
  if (cat.includes('casa') || cat.includes('sobrado')) return 'house';
  if (cat.includes('terreno') || cat.includes('lote')) return 'land';
  if (cat.includes('sala') || cat.includes('comercial') || cat.includes('loja')) return 'commercial';
  // Fallback via real_estate_type value
  const ret = (realEstateType ?? '').toLowerCase();
  if (ret.includes('apart') || ret.includes('cobertura')) return 'apartment';
  if (ret.includes('casa') || ret.includes('sobrado')) return 'house';
  if (ret.includes('terreno') || ret.includes('lote')) return 'land';
  if (ret.includes('sala') || ret.includes('comercial')) return 'commercial';
  return null;
}

function detectOlxOperation(realEstateType: string | undefined): Operation {
  if ((realEstateType ?? '').toLowerCase().startsWith('aluguel')) return 'rent';
  return 'sale';
}

/**
 * Parser de página de listagem da OLX via __NEXT_DATA__ JSON embebido.
 * Mais robusto que cheerio pois não depende de classes CSS React ofuscadas.
 */
export function parseOlxListingPage(html: string, ctx: ParseContext): RawListing[] {
  const out: RawListing[] = [];

  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return out;

  let nextData: NextData;
  try {
    nextData = JSON.parse(match[1]) as NextData;
  } catch {
    return out;
  }

  const ads = nextData.props?.pageProps?.ads;
  if (!Array.isArray(ads)) return out;

  for (const ad of ads) {
    const id = String(ad.listId ?? '');
    const url = ad.friendlyUrl ?? ad.url ?? '';
    if (!id || !url) continue;

    const props: OlxProperty[] = Array.isArray(ad.properties) ? ad.properties : [];
    const realEstateType = getProp(props, 'real_estate_type');
    const sizeRaw = getProp(props, 'size');
    const roomsRaw = getProp(props, 'rooms');
    const bathroomsRaw = getProp(props, 'bathrooms');
    const garageRaw = getProp(props, 'garage_spaces');

    const priceText = ad.priceValue ?? ad.price ?? null;
    const price = parsePriceBRL(priceText);
    const area = parseArea(sizeRaw);
    const bedrooms = parseFirstInt(roomsRaw);
    const bathrooms = parseFirstInt(bathroomsRaw);
    const parking = parseFirstInt(garageRaw);

    // location: "Curitiba, Santa Felicidade - DDD 41" → "Santa Felicidade, Curitiba/PR"
    const locationStr = String(ad.location ?? '');
    const locMatch = locationStr.match(/^([^,]+),\s*([^-]+)/);
    const city = locMatch?.[1]?.trim() ?? '';
    const neighborhood = locMatch?.[2]?.trim();
    const addressRaw = neighborhood && city
      ? `${neighborhood}, ${city}/PR`
      : locationStr || undefined;

    out.push({
      source: 'olx',
      sourceListingId: id,
      url,
      title: ad.subject ?? undefined,
      addressRaw: addressRaw ?? undefined,
      price,
      operation: detectOlxOperation(realEstateType),
      area,
      bedrooms,
      bathrooms,
      parking,
      propertyType: mapOlxType(ad.categoryName, realEstateType),
      scrapedAt: ctx.scrapedAt,
      partial: price === null,
    });
  }

  return out;
}
