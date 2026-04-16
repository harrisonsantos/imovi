/**
 * Faz parse de preço em formato BR para número.
 *
 * Aceita:
 *   - "R$ 1.250.000,00" → 1_250_000
 *   - "R$ 500.000"      → 500_000
 *   - "1250000"         → 1_250_000
 *   - "R$ 3.500,00/mês" → 3_500
 *
 * Retorna null para:
 *   - strings não numéricas ("Consulte", "")
 *   - zero ("R$ 0" não faz sentido para venda/aluguel)
 *
 * Heurística BR:
 *   - Vírgula é separador decimal
 *   - Pontos são separadores de milhar
 *   - Sufixos como "/mês", "R$", espaços são removidos
 */
export function parsePrice(raw: string): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // Remove tudo que não é dígito, vírgula ou ponto.
  // Isso descarta "R$", "/mês", letras, acentos etc.
  const cleaned = trimmed.replace(/[^\d.,]/g, '');
  if (cleaned.length === 0) return null;

  // Se tem vírgula, ela é o separador decimal (padrão BR).
  // Pontos são milhar → remover. Vírgula → ponto.
  let numeric: string;
  if (cleaned.includes(',')) {
    numeric = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Sem vírgula: pontos são separadores de milhar (BR).
    // "1.250.000" → "1250000"; "500.000" → "500000"; "1250000" → "1250000".
    numeric = cleaned.replace(/\./g, '');
  }

  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) return null;
  if (parsed <= 0) return null;
  return parsed;
}
