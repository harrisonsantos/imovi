'use client';

/**
 * Chip de severidade de anomalia: alta (vermelho), média (âmbar), baixa (cinza).
 */

const SEVERITY_COLORS: Record<string, string> = {
  alta: '#f87171',
  media: '#f8b740',
  baixa: '#5e7080',
};

const SEVERITY_LABELS: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

/** Converte #rrggbb em rgba com alpha (para o fundo translúcido do chip). */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function SeverityChip({ severidade }: { severidade: string }) {
  const color = SEVERITY_COLORS[severidade] ?? SEVERITY_COLORS.baixa!;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '6px',
        background: withAlpha(color, 0.1),
        border: `1px solid ${withAlpha(color, 0.25)}`,
        color,
        fontSize: '0.6875rem',
        fontFamily: 'var(--font-mono)',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {SEVERITY_LABELS[severidade] ?? severidade}
    </span>
  );
}
