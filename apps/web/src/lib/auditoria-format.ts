/**
 * Formatadores e rótulos compartilhados do dashboard de auditoria (pt-BR).
 */

/** Moeda BRL a partir de numeric serializado (string) ou número; '—' p/ nulo. */
export function fmtBrl(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/** Data dd/mm/aaaa a partir de timestamp serializado; '—' p/ nulo. */
export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

/** Data e hora dd/mm/aaaa hh:mm; '—' p/ nulo. */
export function fmtDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Rótulos pt-BR dos tipos de anomalia detectados pelo worker. */
export const ANOMALIA_TIPO_LABELS: Record<string, string> = {
  desvio_avm: 'Desvio vs. AVM',
  lead_inativo: 'Lead inativo',
  lead_perdido_rapido: 'Lead perdido rápido',
  negocio_data_futura: 'Negócio com data futura',
  taxa_conversao_baixa: 'Taxa de conversão baixa',
  venda_nao_registrada: 'Venda não registrada',
};

export function anomaliaTipoLabel(tipo: string): string {
  return ANOMALIA_TIPO_LABELS[tipo] ?? tipo;
}
