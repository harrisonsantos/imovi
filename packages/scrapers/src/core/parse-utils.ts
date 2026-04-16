import type { PropertyType, Operation } from '@imovi/shared';

/**
 * Extrai o primeiro valor numérico (inteiro ou decimal) de uma string.
 * Remove separadores de milhar em português (ponto) e trata vírgula como
 * decimal. Retorna `null` se não houver número.
 */
export function parsePriceBRL(raw: string | undefined | null): number | null {
  if (!raw) return null;
  // Remove tudo exceto dígitos, ponto, vírgula
  const cleaned = raw.replace(/[^\d,.]/g, '');
  if (!cleaned) return null;
  // Normaliza: remove pontos de milhar, troca vírgula decimal por ponto
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Extrai o primeiro inteiro não-negativo de uma string. */
export function parseFirstInt(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const m = raw.match(/-?\d+/);
  if (!m) return null;
  const n = Number.parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
}

/** Extrai um número (área), aceita decimais com vírgula ou ponto. */
export function parseArea(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]?.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Mapeia string livre para o enum PropertyType; retorna null se desconhecido. */
export function mapPropertyType(raw: string | undefined | null): PropertyType | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === 'apartment' || v.includes('apart')) return 'apartment';
  if (v === 'house' || v.includes('casa')) return 'house';
  if (v === 'commercial' || v.includes('comerc') || v.includes('sala')) return 'commercial';
  if (v === 'land' || v.includes('terreno') || v.includes('lote')) return 'land';
  return null;
}

/** Mapeia string livre para o enum Operation. Default: 'sale'. */
export function mapOperation(raw: string | undefined | null): Operation {
  if (!raw) return 'sale';
  const v = raw.trim().toLowerCase();
  if (v === 'rent' || v.includes('alug') || v.includes('mês') || v.includes('/mes')) return 'rent';
  return 'sale';
}
