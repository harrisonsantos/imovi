import type { PropertyType, Operation, RawListing } from '@imovi/shared';
import { mapPropertyType } from '../core/parse-utils.js';
import type { ParseContext } from '../zap/parser.js';

function mapVivaRealType(raw: string | undefined | null): PropertyType | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v === 'apartment' || v === 'place') return 'apartment';
  if (v === 'house' || v === 'singlefamilyresidence') return 'house';
  if (v === 'landforsale' || v === 'lot' || v === 'lotorfarm') return 'land';
  if (v === 'commercialproperty' || v === 'officebuilding') return 'commercial';
  return mapPropertyType(raw);
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

function detectOperation(url: string): Operation {
  if (url.includes('/aluguel') || url.includes('/rent')) return 'rent';
  return 'sale';
}

interface VrLdItem {
  '@type'?: string;
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

/** Parser de página de listagem do VivaReal via JSON-LD (schema.org ItemList). */
export function parseVivaRealListingPage(html: string, ctx: ParseContext): RawListing[] {
  const out: RawListing[] = [];
  const scriptRe = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRe.exec(html)) !== null) {
    let data: unknown;
    try { if (match[1] === undefined) continue;
      data = JSON.parse(match[1]); } catch { continue; }

    if (!data || typeof data !== 'object') continue;
    const d = data as { '@type'?: string; itemListElement?: unknown[] };
    if (d['@type'] !== 'ItemList' || !Array.isArray(d.itemListElement)) continue;

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
      const neighborhood = item.name
        ? extractNeighborhoodFromName(item.name, city)
        : undefined;
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
        propertyType: mapVivaRealType(item['@type']),
        scrapedAt: ctx.scrapedAt,
        partial: price === null,
      });
    }
    break;
  }

  return out;
}
