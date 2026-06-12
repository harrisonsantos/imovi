'use client';

/**
 * Tabela genérica do dashboard de auditoria — grid CSS no estilo do dashboard
 * mock (header mono uppercase, hover na linha, estado vazio).
 */
import type { ReactNode } from 'react';
import { tokens as C } from '@/lib/tokens';

export interface Column<T> {
  key: string;
  header: string;
  /** Fração da grid (default '1fr'). */
  width?: string;
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Mensagem do estado vazio. */
  empty?: string;
}

export function DataTable<T>({ columns, rows, rowKey, empty }: DataTableProps<T>) {
  const template = columns.map((c) => c.width ?? '1fr').join(' ');

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: template,
          gap: '0.75rem',
          padding: '0.625rem 1.25rem',
          background: C.surface2,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {columns.map((col) => (
          <span
            key={col.key}
            style={{
              fontSize: '0.5875rem',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: C.text2,
            }}
          >
            {col.header}
          </span>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: '2.5rem 1.25rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.875rem', color: C.text2, margin: 0 }}>
            {empty ?? 'Nenhum registro encontrado.'}
          </p>
        </div>
      ) : (
        rows.map((row, i) => (
          <div
            key={rowKey(row)}
            style={{
              display: 'grid',
              gridTemplateColumns: template,
              gap: '0.75rem',
              padding: '0.875rem 1.25rem',
              borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : 'none',
              alignItems: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = C.surface2;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            {columns.map((col) => (
              <div key={col.key} style={{ fontSize: '0.8125rem', color: C.text, minWidth: 0 }}>
                {col.render(row)}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
