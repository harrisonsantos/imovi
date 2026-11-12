import type { PropertyType, Operation, RawListing } from '@imovi/shared';
import { mapPropertyType } from '../core/parse-utils.js';

export interface ParseContext {
  sourceUrl: string;
  scrapedAt: Date;
}

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
  if (v === 'commercialproperty') return 'commercial';
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

/** Inferência por palavras-chave no título/URL (schema Place ou additionalType genérico). */
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

interface ZapLdItem {
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

function resolveZapPropertyType(item: ZapLdItem): PropertyType | null {
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

/** Extrai "X vaga(s)" do name/keywords. */
function parseParking(text: string | undefined | null): number | null {
  if (!text) return null;
  const m = text.match(/(\d+)\s*vaga/i);
  return m?.[1] ? Number.parseInt(m[1], 10) : null;
}

/** Extrai bairro do `name`: "... em {bairro}, {cidade}" */
function extractNeighborhoodFromName(name: string, city: string): string | undefined {
  const pattern = new RegExp(`em\\s+(.+?),\\s*${city}`, 'i');
  const m = name.match(pattern);
  return m?.[1]?.trim();
}

/** Detecta operation a partir da URL. */
function detectOperation(url: string): Operation {
  if (url.includes('/aluguel') || url.includes('/rent')) return 'rent';
  return 'sale';
}

/**
 * Parser de página de listagem do Zap via JSON-LD (schema.org ItemList).
 * Mais robusto que cheerio pois não depende de classes CSS ofuscadas.
 */
export function parseZapListingPage(html: string, ctx: ParseContext): RawListing[] {
  const out: RawListing[] = [];

  // Extrai todos os scripts JSON-LD
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

    for (const listItem of d.itemListElement) {
      if (!listItem || typeof listItem !== 'object') continue;
      const li = listItem as { item?: ZapLdItem };
      const item = li.item;
      if (!item || !item['@id'] || !item.url) continue;

      const sourceListingId = String(item['@id']);
      const url = item.url;
      const title = item.name;
      const description = item.description;
      const operation = detectOperation(url);

      const price = typeof item.offers?.price === 'number' ? item.offers.price : null;
      const area =
        typeof item.floorSize?.value === 'number' && item.floorSize.value > 0
          ? item.floorSize.value
          : null;
      const bedrooms =
        typeof item.numberOfBedrooms === 'number' ? item.numberOfBedrooms : null;
      const bathrooms =
        typeof item.numberOfBathroomsTotal === 'number' ? item.numberOfBathroomsTotal : null;
      const parking = parseParking(item.keywords ?? item.name);
      const propertyType = resolveZapPropertyType(item);

      // Constrói addressRaw combinando street + bairro + cidade/UF
      const street = item.address?.streetAddress;
      const city = item.address?.addressLocality ?? 'Curitiba';
      const state = item.address?.addressRegion ?? 'PR';
      const neighborhood = title ? extractNeighborhoodFromName(title, city) : undefined;
      const addressRaw = [street, neighborhood, `${city}/${state}`]
        .filter(Boolean)
        .join(' - ');

      out.push({
        source: 'zap',
        sourceListingId,
        url,
        title: title ?? undefined,
        description: description ?? undefined,
        addressRaw: addressRaw || undefined,
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
    }
    break; // Apenas o primeiro ItemList
  }

  return out;
}
