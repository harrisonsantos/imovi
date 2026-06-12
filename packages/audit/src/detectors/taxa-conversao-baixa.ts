/**
 * Detector: corretor com taxa de conversão muito abaixo da média global.
 *
 * Matemática portada de imobcheck/lib/detectors/patterns.ts +
 * anomaly-detector.ts (caso 2): taxa = negocios/leads * 100 (2 casas);
 * anômalo quando taxa < 30% da média global e o corretor tem > 10 leads.
 */
import type { DetectedAnomalia } from './types.js';

export interface CorretorStats {
  corretorId: string;
  totalLeads: number;
  /** Negócios fechados (status 'concluído') do corretor. */
  totalNegocios: number;
}

/** Taxa de conversão em %, arredondada a 2 casas (porta de patterns.ts). */
export function calcularTaxaConversao(totalNegocios: number, totalLeads: number): number {
  const taxa = totalLeads > 0 ? (totalNegocios / totalLeads) * 100 : 0;
  return parseFloat(taxa.toFixed(2));
}

export function detectTaxaConversaoBaixa(statsPorCorretor: CorretorStats[]): DetectedAnomalia[] {
  if (statsPorCorretor.length === 0) return [];

  const taxas = statsPorCorretor.map((s) => ({
    ...s,
    taxa: calcularTaxaConversao(s.totalNegocios, s.totalLeads),
  }));
  const mediaGlobal = taxas.reduce((acc, t) => acc + t.taxa, 0) / taxas.length;

  const anomalias: DetectedAnomalia[] = [];
  for (const t of taxas) {
    if (!(t.taxa < mediaGlobal * 0.3 && t.totalLeads > 10)) continue;

    anomalias.push({
      tipo: 'taxa_conversao_baixa',
      severidade: 'alta',
      corretorId: t.corretorId,
      entidadeTipo: 'corretor',
      entidadeId: t.corretorId,
      descricao: `Taxa de conversão de ${t.taxa}% muito abaixo da média global (${mediaGlobal.toFixed(2)}%). ${t.totalLeads} leads e ${t.totalNegocios} negócios fechados.`,
      dadosContexto: {
        taxa: t.taxa,
        mediaGlobal,
        totalLeads: t.totalLeads,
        totalNegocios: t.totalNegocios,
      },
    });
  }

  return anomalias;
}
