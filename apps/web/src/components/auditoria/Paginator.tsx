'use client';

/**
 * Paginação simples anterior/próxima por offset. "Próxima" desabilita quando a
 * página atual veio incompleta (count < limit) — heurística sem total no servidor.
 */
import { tokens as C } from '@/lib/tokens';

export interface PaginatorProps {
  offset: number;
  limit: number;
  /** Quantidade de linhas retornadas na página atual. */
  count: number;
  onChange: (newOffset: number) => void;
}

const btnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '0.375rem 0.875rem',
  background: C.surface2,
  border: `1px solid ${C.border}`,
  borderRadius: '7px',
  color: disabled ? C.text3 : C.text2,
  fontSize: '0.75rem',
  fontFamily: 'var(--font-body)',
  cursor: disabled ? 'not-allowed' : 'pointer',
});

export function Paginator({ offset, limit, count, onChange }: PaginatorProps) {
  const page = Math.floor(offset / limit) + 1;
  const prevDisabled = offset <= 0;
  const nextDisabled = count < limit;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end' }}>
      <button
        type="button"
        disabled={prevDisabled}
        onClick={() => onChange(Math.max(0, offset - limit))}
        style={btnStyle(prevDisabled)}
      >
        ← Anterior
      </button>
      <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: C.text2 }}>
        página {page}
      </span>
      <button
        type="button"
        disabled={nextDisabled}
        onClick={() => onChange(offset + limit)}
        style={btnStyle(nextDisabled)}
      >
        Próxima →
      </button>
    </div>
  );
}
