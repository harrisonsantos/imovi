/**
 * Faz parse de área em formato BR para número (m²).
 *
 * Aceita:
 *   - "62m²"       → 62
 *   - "62 m2"      → 62
 *   - "62.5m²"     → 62.5
 *   - "62,5 m²"    → 62.5
 *   - "62 metros"  → 62
 *
 * Retorna null para input não-numérico ou vazio.
 */
export function parseArea(raw: string): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // Extrai o primeiro token numérico (aceitando . ou , como decimal).
  const match = trimmed.match(/(\d+(?:[.,]\d+)?)/);
  if (!match || match[1] === undefined) return null;

  const numeric = match[1].replace(',', '.');
  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) return null;
  if (parsed <= 0) return null;
  return parsed;
}
