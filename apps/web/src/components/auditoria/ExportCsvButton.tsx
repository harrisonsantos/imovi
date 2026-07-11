'use client';

/**
 * Botão de exportação CSV client-side: monta o arquivo a partir das linhas já
 * carregadas (Blob + download), no padrão Excel pt-BR (BOM, separador `;`).
 */
import { buildCsv, type CsvValue } from '@/lib/csv';
import { tokens as C } from '@/lib/tokens';

export interface ExportCsvButtonProps {
  /** Nome do arquivo sem extensão (ex.: 'anomalias'). */
  filename: string;
  headers: string[];
  rows: CsvValue[][];
  disabled?: boolean;
}

export function ExportCsvButton({ filename, headers, rows, disabled }: ExportCsvButtonProps) {
  function handleExport() {
    const csv = buildCsv(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isDisabled = disabled || rows.length === 0;
  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isDisabled}
      style={{
        padding: '0.4375rem 0.875rem',
        background: C.surface2,
        border: `1px solid ${C.border}`,
        borderRadius: '7px',
        color: isDisabled ? C.text3 : C.text2,
        fontSize: '0.75rem',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          (e.currentTarget as HTMLElement).style.borderColor = C.accent;
          (e.currentTarget as HTMLElement).style.color = C.accent;
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = C.border;
        (e.currentTarget as HTMLElement).style.color = isDisabled ? C.text3 : C.text2;
      }}
    >
      ↓ Exportar CSV
    </button>
  );
}
