/**
 * Utilitário de CSV no padrão pt-BR/Excel:
 *   - Separador `;` (Excel pt-BR usa vírgula como decimal, então `,` quebraria).
 *   - BOM UTF-8 (U+FEFF) no início para o Excel detectar a codificação.
 *   - Campos com `;`, aspas ou quebras de linha são envolvidos em aspas duplas;
 *     aspas internas são escapadas duplicando (`"` → `""`).
 */

export type CsvValue = string | number | boolean | null | undefined;

export const CSV_BOM = String.fromCharCode(0xfeff);
export const CSV_SEPARATOR = ';';

/** Converte um valor em célula CSV, escapando quando necessário. */
export function csvEscape(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(CSV_SEPARATOR) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Monta o conteúdo completo do CSV (BOM + cabeçalho + linhas, CRLF). */
export function buildCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [
    headers.map(csvEscape).join(CSV_SEPARATOR),
    ...rows.map((row) => row.map(csvEscape).join(CSV_SEPARATOR)),
  ];
  return CSV_BOM + lines.join('\r\n');
}
