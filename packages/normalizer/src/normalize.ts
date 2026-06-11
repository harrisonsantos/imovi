import {
  NormalizedListingSchema,
  type NormalizedAddress,
  type NormalizedListing,
  type RawListing,
} from '@imovi/shared';
import { parseAddress } from './parsers/address.js';
import { resolveAddressFallback } from './parsers/cep-fallback.js';

/**
 * Transforma RawListing → NormalizedListing.
 *
 * Como o RawListingSchema já traz `price` e `area` como números (ou null),
 * os parsers de string (parsePrice/parseArea) são usados pelos scrapers upstream,
 * não aqui. Aqui normalizamos endereço e validamos que os campos obrigatórios
 * não são nulos.
 *
 * Lança Error com mensagem descritiva quando o RawListing não tem dados suficientes.
 */
export function normalize(raw: RawListing): NormalizedListing {
  if (raw.price === null) {
    throw new Error('normalização requer preço: RawListing.price é null');
  }
  if (raw.price <= 0) {
    throw new Error('normalização requer preço positivo');
  }
  if (raw.area === null) {
    throw new Error('normalização requer área: RawListing.area é null');
  }
  if (raw.propertyType === null) {
    throw new Error('normalização requer propertyType: RawListing.propertyType é null');
  }
  if (!raw.addressRaw) {
    throw new Error('normalização requer addressRaw');
  }

  const fallback = resolveAddressFallback(raw.addressRaw);
  const addressNormalized: NormalizedAddress | null =
    parseAddress(raw.addressRaw) ??
    (fallback ? parseAddress(raw.addressRaw, fallback) : null);
  if (!addressNormalized) {
    throw new Error(`normalização falhou: endereço não parseável: "${raw.addressRaw}"`);
  }

  const candidate: NormalizedListing = {
    ...raw,
    price: raw.price,
    area: raw.area,
    propertyType: raw.propertyType,
    addressNormalized,
  };

  const parsed = NormalizedListingSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(
      `normalização falhou na validação do schema: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}
