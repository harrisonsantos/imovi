import { createHash } from 'node:crypto';
import type { NormalizedListing } from '../types/listing.js';

/**
 * Arredonda para o m² inteiro mais próximo.
 * Tolera variações naturais de ±1m² entre anúncios do mesmo imóvel.
 */
function roundArea(area: number): number {
  return Math.round(area);
}

/** Normaliza CEP removendo traços. */
function normalizeCep(cep: string): string {
  return cep.replace(/-/g, '');
}

/** Lowercase + trim + colapsa whitespace. */
function canonicalize(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Gera fingerprint estável para dedupe cross-portal.
 * Anúncios do mesmo imóvel em portais diferentes produzem o mesmo hash.
 *
 * Chaves usadas:
 *   - CEP (sem traço)
 *   - rua (case-insensitive)
 *   - número do endereço (quando presente)
 *   - área arredondada (tolerância ±1m²)
 *   - tipo de imóvel
 *   - número de quartos
 */
export function computeFingerprint(listing: NormalizedListing): string {
  const addr = listing.addressNormalized;
  const parts = [
    normalizeCep(addr.cep),
    canonicalize(addr.street),
    addr.number ? canonicalize(addr.number) : '',
    roundArea(listing.area).toString(),
    listing.propertyType,
    (listing.bedrooms ?? -1).toString(),
  ];
  return createHash('sha256').update(parts.join('::')).digest('hex').slice(0, 32);
}
