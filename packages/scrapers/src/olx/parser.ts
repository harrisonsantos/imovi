import type { PropertyType, Operation, RawListing } from '@imovi/shared';
import { parsePriceBRL, parseArea, parseFirstInt } from '../core/parse-utils.js';
import type { ParseContext } from '../zap/parser.js';

interface OlxProperty {
  name: string;
  value: string;
}

interface OlxLocationDetails {
  municipality?: string;
  neighbourhood?: string;
  neighborhood?: string;
}

interface OlxAd {
  listId: string | number;
  subject?: string;
  priceValue?: string | null;
  price?: string | null;
  friendlyUrl?: string;
  url?: string;
  location?: string;
  locationDetails?: OlxLocationDetails;
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

function formatAddressFromAd(ad: OlxAd): string | undefined {
  const details = ad.locationDetails;
  if (details?.municipality) {
    const neighborhood = details.neighbourhood ?? details.neighborhood;
    if (neighborhood) return `${neighborhood}, ${details.municipality}/PR`;
    return `${details.municipality}/PR`;
  }

  const locationStr = String(ad.location ?? '');
  const locMatch = locationStr.match(/^([^,]+),\s*([^-]+)/);
  const city = locMatch?.[1]?.trim() ?? '';
  const neighborhood = locMatch?.[2]?.trim();
  if (neighborhood && city) return `${neighborhood}, ${city}/PR`;
  return locationStr || undefined;
}

function mapAdToRawListing(ad: OlxAd, ctx: ParseContext): RawListing | null {
  const id = String(ad.listId ?? '');
  const url = ad.friendlyUrl ?? ad.url ?? '';
  if (!id || !url) return null;

  const props: OlxProperty[] = Array.isArray(ad.properties) ? ad.properties : [];
  const realEstateType = getProp(props, 'real_estate_type');
  const sizeRaw = getProp(props, 'size');
  const roomsRaw = getProp(props, 'rooms');
  const bathroomsRaw = getProp(props, 'bathrooms');
  const garageRaw = getProp(props, 'garage_spaces');

  const priceText = ad.priceValue ?? ad.price ?? null;
  const price = parsePriceBRL(priceText);

  return {
    source: 'olx',
    sourceListingId: id,
    url,
    title: ad.subject ?? undefined,
    addressRaw: formatAddressFromAd(ad),
    price,
    operation: detectOlxOperation(realEstateType),
    area: parseArea(sizeRaw),
    bedrooms: parseFirstInt(roomsRaw),
    bathrooms: parseFirstInt(bathroomsRaw),
    parking: parseFirstInt(garageRaw),
    propertyType: mapOlxType(ad.categoryName, realEstateType),
    scrapedAt: ctx.scrapedAt,
    partial: price === null,
  };
}

function parseAdsFromNextData(html: string): OlxAd[] | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match || match[1] === undefined) return null;

  try {
    const nextData = JSON.parse(match[1]) as NextData;
    const ads = nextData.props?.pageProps?.ads;
    return Array.isArray(ads) ? ads : null;
  } catch {
    return null;
  }
}

/** Localiza `"ads":[...]` em chunks RSC (`self.__next_f.push`). */
function parseAdsFromRscChunks(html: string): OlxAd[] {
  const pushRe = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
  const ads: OlxAd[] = [];
  let pushMatch: RegExpExecArray | null;

  while ((pushMatch = pushRe.exec(html)) !== null) {
    const rawChunk = pushMatch[1];
    if (!rawChunk) continue;

    const chunk = rawChunk
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n');

    const adsIdx = chunk.indexOf('"ads":');
    if (adsIdx < 0) continue;

    const arrayStart = chunk.indexOf('[', adsIdx);
    if (arrayStart < 0) continue;

    let depth = 0;
    let arrayEnd = -1;
    for (let i = arrayStart; i < chunk.length; i += 1) {
      const ch = chunk[i];
      if (ch === '[') depth += 1;
      else if (ch === ']') {
        depth -= 1;
        if (depth === 0) {
          arrayEnd = i;
          break;
        }
      }
    }
    if (arrayEnd < 0) continue;

    const adsJson = chunk.slice(arrayStart, arrayEnd + 1);
    try {
      const parsed = JSON.parse(adsJson) as OlxAd[];
      if (Array.isArray(parsed)) ads.push(...parsed);
    } catch {
      // tenta próximo chunk
    }
  }

  return ads;
}

/**
 * Parser de página de listagem da OLX via __NEXT_DATA__ ou payloads RSC (App Router).
 */
export function parseOlxListingPage(html: string, ctx: ParseContext): RawListing[] {
  const out: RawListing[] = [];

  let ads = parseAdsFromNextData(html);
  if (!ads || ads.length === 0) {
    ads = parseAdsFromRscChunks(html);
  }

  if (!Array.isArray(ads) || ads.length === 0) return out;

  for (const ad of ads) {
    const listing = mapAdToRawListing(ad, ctx);
    if (listing) out.push(listing);
  }

  return out;
}
