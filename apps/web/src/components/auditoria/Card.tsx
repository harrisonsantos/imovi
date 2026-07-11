'use client';

/**
 * Card de KPI do dashboard de auditoria — espelha o estilo dos cards do
 * dashboard mock (surface + borda, valor em fonte mono, sub em text3).
 */
import { tokens as C } from '@/lib/tokens';

export interface CardProps {
  label: string;
  value: string | number;
  sub?: string;
  /** Cor opcional para o valor (ex.: vermelho quando há anomalias abertas). */
  valueColor?: string;
}

export function Card({ label, value, sub, valueColor }: CardProps) {
  return (
    <div
      style={{
        padding: '1.125rem',
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: '12px',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = C.borderMid;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = C.border;
      }}
    >
      <p style={{ fontSize: '0.6875rem', color: C.text2, marginBottom: '6px' }}>{label}</p>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '1.5rem',
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: valueColor ?? C.text,
          lineHeight: 1.1,
          marginBottom: '4px',
        }}
      >
        {value}
      </p>
      {sub && <span style={{ fontSize: '0.625rem', color: C.text3 }}>{sub}</span>}
    </div>
  );
}
