/**
 * Relatório diário de auditoria (fase 5) — funções puras.
 *
 *   - `buildDailyReport`: agrega métricas a partir de arrays de linhas
 *     (leads, negócios, corretores, anomalias) sem tocar no banco;
 *   - `dailyReportHtml`: HTML self-contained para e-mail.
 *
 * Decisão de layout: o dark navy (#07090e) da marca é hostil a clientes de
 * e-mail (Gmail/Outlook reescrevem dark mode de formas imprevisíveis), então
 * o e-mail usa fundo claro com o emerald #00d97e da paleta como destaque.
 * Apenas tabelas + estilos inline (sem <link>/<script>) por compatibilidade.
 */

export interface ReportLeadRow {
  id: string;
  corretorId: string | null;
  createdAt: Date;
}

export interface ReportNegocioRow {
  id: string;
  corretorId: string | null;
  status: string | null;
  dataFechamento: Date | null;
}

export interface ReportCorretorRow {
  id: string;
  nome: string;
}

export interface ReportAnomaliaRow {
  severidade: string;
  createdAt: Date;
}

export interface DailyReportInput {
  /** Instante de referência — define o "dia" (UTC) do relatório. */
  now: Date;
  leads: ReportLeadRow[];
  negocios: ReportNegocioRow[];
  corretores: ReportCorretorRow[];
  anomalias: ReportAnomaliaRow[];
}

export interface TopCorretor {
  corretorId: string;
  nome: string;
  negocios: number;
}

export interface DailyReport {
  /** Dia de referência em ISO (YYYY-MM-DD, UTC). */
  dataReferencia: string;
  leadsDoDia: number;
  negociosFechadosDoDia: number;
  /** Negócios concluídos / total de leads, em % (1 casa decimal). */
  taxaConversaoGeral: number;
  /** Anomalias criadas no dia de referência, por severidade. */
  anomaliasPorSeveridade: { alta: number; media: number; baixa: number };
  /** Até 5 corretores, ordenados por negócios concluídos (desc). */
  topCorretores: TopCorretor[];
}

const TOP_CORRETORES_LIMITE = 5;

/** Dia UTC em ISO (YYYY-MM-DD) — base de comparação "mesmo dia". */
const diaUtc = (d: Date): string => d.toISOString().slice(0, 10);

export function buildDailyReport(input: DailyReportInput): DailyReport {
  const hoje = diaUtc(input.now);

  const leadsDoDia = input.leads.filter((l) => diaUtc(l.createdAt) === hoje).length;

  const negociosFechadosDoDia = input.negocios.filter(
    (n) => n.dataFechamento != null && diaUtc(n.dataFechamento) === hoje,
  ).length;

  // Taxa de conversão geral: concluídos sobre TODOS os leads (histórico).
  const concluidos = input.negocios.filter((n) => n.status === 'concluído');
  const taxaConversaoGeral =
    input.leads.length === 0
      ? 0
      : Math.round((concluidos.length / input.leads.length) * 1000) / 10;

  // Anomalias novas (criadas hoje) por severidade conhecida.
  const anomaliasPorSeveridade = { alta: 0, media: 0, baixa: 0 };
  for (const a of input.anomalias) {
    if (diaUtc(a.createdAt) !== hoje) continue;
    if (a.severidade === 'alta' || a.severidade === 'media' || a.severidade === 'baixa') {
      anomaliasPorSeveridade[a.severidade] += 1;
    }
  }

  // Top corretores por negócios concluídos (nome resolvido; fallback = id).
  const porCorretor = new Map<string, number>();
  for (const n of concluidos) {
    if (n.corretorId == null) continue;
    porCorretor.set(n.corretorId, (porCorretor.get(n.corretorId) ?? 0) + 1);
  }
  const nomePorId = new Map(input.corretores.map((c) => [c.id, c.nome]));
  const topCorretores: TopCorretor[] = [...porCorretor.entries()]
    .map(([corretorId, negocios]) => ({
      corretorId,
      nome: nomePorId.get(corretorId) ?? corretorId,
      negocios,
    }))
    .sort((a, b) => b.negocios - a.negocios || a.nome.localeCompare(b.nome))
    .slice(0, TOP_CORRETORES_LIMITE);

  return {
    dataReferencia: hoje,
    leadsDoDia,
    negociosFechadosDoDia,
    taxaConversaoGeral,
    anomaliasPorSeveridade,
    topCorretores,
  };
}

/** Escapa texto interpolado no HTML (nomes de org/corretor vêm do banco). */
const esc = (s: string): string =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/* Paleta e-mail-safe: fundo claro + emerald Imovi como acento. */
const EMERALD = '#00d97e';
const TEXTO = '#1a2233';
const TEXTO_SUAVE = '#5a6478';
const BORDA = '#e4e8ef';
const FUNDO = '#f5f7fa';
const FONTE =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const SEVERIDADE_COR: Record<'alta' | 'media' | 'baixa', string> = {
  alta: '#d92d20',
  media: '#dc8a00',
  baixa: TEXTO_SUAVE,
};

/** Célula de métrica (cartão) com número grande e rótulo. */
function metricaHtml(rotulo: string, valor: string): string {
  return `<td width="33%" style="padding:6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${BORDA};border-radius:8px;">
      <tr><td style="padding:16px;text-align:center;">
        <div style="font-family:${FONTE};font-size:28px;font-weight:700;color:${TEXTO};line-height:1.2;">${valor}</div>
        <div style="font-family:${FONTE};font-size:12px;color:${TEXTO_SUAVE};margin-top:4px;">${rotulo}</div>
      </td></tr>
    </table>
  </td>`;
}

export function dailyReportHtml(report: DailyReport, orgName: string): string {
  const linhasAnomalias = (
    [
      ['alta', 'Alta'],
      ['media', 'Média'],
      ['baixa', 'Baixa'],
    ] as const
  )
    .map(
      ([chave, rotulo]) => `<tr>
        <td style="font-family:${FONTE};font-size:14px;color:${SEVERIDADE_COR[chave]};padding:8px 12px;border-top:1px solid ${BORDA};font-weight:600;">${rotulo}</td>
        <td align="right" style="font-family:${FONTE};font-size:14px;color:${TEXTO};padding:8px 12px;border-top:1px solid ${BORDA};">${report.anomaliasPorSeveridade[chave]}</td>
      </tr>`,
    )
    .join('');

  const linhasCorretores =
    report.topCorretores.length === 0
      ? `<tr><td colspan="2" style="font-family:${FONTE};font-size:14px;color:${TEXTO_SUAVE};padding:8px 12px;border-top:1px solid ${BORDA};">Nenhum negócio concluído registrado.</td></tr>`
      : report.topCorretores
          .map(
            (c) => `<tr>
        <td style="font-family:${FONTE};font-size:14px;color:${TEXTO};padding:8px 12px;border-top:1px solid ${BORDA};">${esc(c.nome)}</td>
        <td align="right" style="font-family:${FONTE};font-size:14px;color:${TEXTO};padding:8px 12px;border-top:1px solid ${BORDA};">${c.negocios}</td>
      </tr>`,
          )
          .join('');

  const secao = (titulo: string, corpo: string): string => `<tr><td style="padding:12px 6px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${BORDA};border-radius:8px;">
      <tr><td style="font-family:${FONTE};font-size:13px;font-weight:700;color:${TEXTO};padding:12px;text-transform:uppercase;letter-spacing:0.5px;">${titulo}</td></tr>
      ${corpo}
    </table>
  </td></tr>`;

  return `<!-- Relatório diário de auditoria Imovi -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FUNDO};padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="padding:0 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${BORDA};border-radius:8px;border-top:4px solid ${EMERALD};">
          <tr><td style="padding:20px;">
            <div style="font-family:${FONTE};font-size:18px;font-weight:700;color:${TEXTO};">Auditoria diária — ${esc(orgName)}</div>
            <div style="font-family:${FONTE};font-size:13px;color:${TEXTO_SUAVE};margin-top:4px;">Relatório de ${report.dataReferencia} · Imovi</div>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding-top:12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          ${metricaHtml('Leads do dia', `${report.leadsDoDia}`)}
          ${metricaHtml('Negócios fechados', `${report.negociosFechadosDoDia}`)}
          ${metricaHtml('Conversão geral', `${report.taxaConversaoGeral.toLocaleString('pt-BR')}%`)}
        </tr></table>
      </td></tr>
      ${secao('Anomalias novas por severidade', linhasAnomalias)}
      ${secao('Top corretores por negócios', linhasCorretores)}
      <tr><td style="padding:16px 6px;text-align:center;">
        <div style="font-family:${FONTE};font-size:11px;color:${TEXTO_SUAVE};">
          E-mail automático do módulo de auditoria <span style="color:${EMERALD};font-weight:700;">Imovi</span>. Não responda.
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}
