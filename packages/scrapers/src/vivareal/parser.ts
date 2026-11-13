import { load } from 'cheerio';
import type { PropertyType, Operation, RawListing } from '@imovi/shared';
import { mapPropertyType } from '../core/parse-utils.js';
import type { ParseContext } from '../zap/parser.js';

function schemaOrgToken(raw: string): string {
  const trimmed = raw.trim();
  const idx = trimmed.lastIndexOf('/');
  return (idx >= 0 ? trimmed.slice(idx + 1) : trimmed).toLowerCase();
}

function mapDirectSchemaType(raw: string | undefined | null): PropertyType | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v === 'apartment') return 'apartment';
  if (v === 'house' || v === 'singlefamilyresidence') return 'house';
  if (v === 'landforsale' || v === 'lot' || v === 'lotorfarm' || v === 'landform' || v === 'land')
    return 'land';
  if (v === 'commercialproperty' || v === 'officebuilding') return 'commercial';
  if (v === 'product' || v === 'place') return null;
  return mapPropertyType(raw);
}

function mapAdditionalTypeTokens(tokens: string[]): PropertyType | null {
  for (const token of tokens) {
    if (token === 'apartment') return 'apartment';
    if (token === 'house' || token === 'singlefamilyresidence') return 'house';
    if (token === 'landform' || token === 'land' || token === 'landforsale') return 'land';
    if (token === 'commercialproperty' || token === 'officebuilding') return 'commercial';
    if (token !== 'place' && token !== 'product') {
      const mapped = mapPropertyType(token);
      if (mapped) return mapped;
    }
  }
  return null;
}

function inferPropertyTypeFromText(
  name: string | undefined,
  url: string | undefined,
): PropertyType | null {
  const text = `${name ?? ''} ${url ?? ''}`.toLowerCase();
  if (/cobertura|apartamento|studio|kitnet|flat/.test(text)) return 'apartment';
  if (/casa|sobrado|condom[ií]nio fechado/.test(text)) return 'house';
  if (/terreno|lote/.test(text)) return 'land';
  if (/sala|loja|comercial|galp[aã]o|conjunto|pr[eé]dio/.test(text)) return 'commercial';
  return null;
}

interface VrLdItem {
  '@type'?: string;
  additionalType?: string | string[];
  '@id'?: string;
  name?: string;
  url?: string;
  description?: string;
  keywords?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
  };
  floorSize?: { value?: number };
  numberOfBedrooms?: number;
  numberOfBathroomsTotal?: number;
  offers?: { price?: number };
}

function resolveVivaRealPropertyType(item: VrLdItem): PropertyType | null {
  const atType = item['@type'];
  const direct = mapDirectSchemaType(atType);
  const isProduct = (atType ?? '').toLowerCase() === 'product';

  if (!isProduct && direct) return direct;

  const additionalRaw = item.additionalType;
  const additionalTokens = Array.isArray(additionalRaw)
    ? additionalRaw.map(schemaOrgToken)
    : additionalRaw
      ? [schemaOrgToken(additionalRaw)]
      : [];

  const fromAdditional = mapAdditionalTypeTokens(additionalTokens);
  if (fromAdditional) return fromAdditional;

  const hasOnlyPlace =
    additionalTokens.length === 0 ||
    additionalTokens.every((t) => t === 'place' || t === 'product');

  if (isProduct || hasOnlyPlace || !direct) {
    return inferPropertyTypeFromText(item.name, item.url);
  }

  return direct;
}

function parseParking(text: string | undefined | null): number | null {
  if (!text) return null;
  const m = text.match(/(\d+)\s*vaga/i);
  return m?.[1] ? Number.parseInt(m[1], 10) : null;
}

function extractNeighborhoodFromName(name: string, city: string): string | undefined {
  const pattern = new RegExp(`em\\s+(.+?),\\s*${city}`, 'i');
  return name.match(pattern)?.[1]?.trim();
}

function nameEndsTruncatedAtEm(name: string): boolean {
  return /\bem\s*$/i.test(name.trim());
}

function titleCaseSlugPart(part: string): string {
  return part
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Extrai bairro do slug da URL imóvel VivaReal (antes do token da cidade). */
function extractNeighborhoodFromUrl(url: string, city: string): string | undefined {
  try {
    const path = new URL(url).pathname.toLowerCase();
    const cityToken = city.toLowerCase().replace(/\s+/g, '-');
    const marker = `-${cityToken}-`;
    const idx = path.indexOf(marker);
    if (idx < 0) return undefined;

    const beforeCity = path.slice(0, idx);
    const segments = beforeCity.split('/').filter(Boolean);
    const slug = segments.at(-1) ?? '';
    const slugParts = slug.split('-').filter(Boolean);
    const cityIdx = slugParts.findIndex((p) => p === cityToken);
    const partsBeforeCity =
      cityIdx > 0 ? slugParts.slice(0, cityIdx) : slugParts;

    const skip = new Set([
      'imovel',
      'venda',
      'aluguel',
      'casa',
      'apartamento',
      'quartos',
      'quarto',
      'suites',
      'suite',
      'banheiros',
      'banheiro',
      'vagas',
      'vaga',
      'garagem',
      'na',
      'com',
      'de',
      'para',
      'bairros',
      'bairro',
    ]);

    const neighborhoodParts: string[] = [];
    for (let i = partsBeforeCity.length - 1; i >= 0; i -= 1) {
      const part = partsBeforeCity[i];
      if (!part || skip.has(part) || /^\d+$/.test(part)) continue;
      neighborhoodParts.unshift(part);
      if (neighborhoodParts.length >= 3) break;
    }

    if (neighborhoodParts.length === 0) return undefined;
    return titleCaseSlugPart(neighborhoodParts.join('-'));
  } catch {
    return undefined;
  }
}

function extractNeighborhoodFromDom(html: string): string[] {
  const $ = load(html);
  const labels: string[] = [];
  $('[data-cy="rp-cardProperty-location-txt"]').each((_, el) => {
    const text = $(el).text().trim();
    if (!text) return;
    const neighborhood = text.split(',')[0]?.trim();
    if (neighborhood) labels.push(neighborhood);
  });
  return labels;
}

function resolveNeighborhood(
  item: VrLdItem,
  city: string,
  html: string,
  domLocations: string[],
  itemIndex: number,
): string | undefined {
  const name = item.name ?? '';
  const fromName = name ? extractNeighborhoodFromName(name, city) : undefined;
  if (fromName) return fromName;

  if (!nameEndsTruncatedAtEm(name)) return undefined;

  const fromDom = domLocations[itemIndex];
  if (fromDom) return fromDom;

  return item.url ? extractNeighborhoodFromUrl(item.url, city) : undefined;
}

function detectOperation(url: string): Operation {
  if (url.includes('/aluguel') || url.includes('/rent')) return 'rent';
  return 'sale';
}

/** Parser de página de listagem do VivaReal via JSON-LD (schema.org ItemList). */
export function parseVivaRealListingPage(html: string, ctx: ParseContext): RawListing[] {
  const out: RawListing[] = [];
  const domLocations = extractNeighborhoodFromDom(html);
  const scriptRe = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRe.exec(html)) !== null) {
    let data: unknown;
    try {
      if (match[1] === undefined) continue;
      data = JSON.parse(match[1]);
    } catch {
      continue;
    }

    if (!data || typeof data !== 'object') continue;
    const d = data as { '@type'?: string; itemListElement?: unknown[] };
    if (d['@type'] !== 'ItemList' || !Array.isArray(d.itemListElement)) continue;

    let itemIndex = 0;
    for (const listItem of d.itemListElement) {
      if (!listItem || typeof listItem !== 'object') continue;
      const item = (listItem as { item?: VrLdItem }).item;
      if (!item?.['@id'] || !item.url) continue;

      const price =
        typeof item.offers?.price === 'number' ? item.offers.price : null;
      const area =
        typeof item.floorSize?.value === 'number' && item.floorSize.value > 0
          ? item.floorSize.value
          : null;
      const city = item.address?.addressLocality ?? 'Curitiba';
      const state = item.address?.addressRegion ?? 'PR';
      const neighborhood = resolveNeighborhood(item, city, html, domLocations, itemIndex);
      itemIndex += 1;
      const addressRaw = [item.address?.streetAddress, neighborhood, `${city}/${state}`]
        .filter(Boolean)
        .join(' - ');

      out.push({
        source: 'vivareal',
        sourceListingId: String(item['@id']),
        url: item.url,
        title: item.name ?? undefined,
        description: item.description ?? undefined,
        addressRaw: addressRaw || undefined,
        price,
        operation: detectOperation(item.url),
        area,
        bedrooms: typeof item.numberOfBedrooms === 'number' ? item.numberOfBedrooms : null,
        bathrooms:
          typeof item.numberOfBathroomsTotal === 'number'
            ? item.numberOfBathroomsTotal
            : null,
        parking: parseParking(item.keywords ?? item.name),
        propertyType: resolveVivaRealPropertyType(item),
        scrapedAt: ctx.scrapedAt,
        partial: price === null,
      });
    }
    break;
  }

  return out;
}
