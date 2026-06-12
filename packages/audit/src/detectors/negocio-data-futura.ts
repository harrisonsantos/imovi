/**
 * Detector: negócio com data de fechamento no futuro.
 *
 * Portado de detector legado do ImobCheck (caso 5).
 */
import type { AuditNegocio } from '@imovi/db/schema-audit';
import type { DetectedAnomalia } from './types.js';

export function detectNegocioDataFutura(
  negocios: AuditNegocio[],
  today: Date,
): DetectedAnomalia[] {
  const anomalias: DetectedAnomalia[] = [];

  for (const negocio of negocios) {
    if (negocio.dataFechamento == null) continue;
    if (negocio.dataFechamento.getTime() <= today.getTime()) continue;

    anomalias.push({
      tipo: 'negocio_data_futura',
      severidade: 'media',
      corretorId: negocio.corretorId,
      entidadeTipo: 'negocio',
      entidadeId: negocio.id,
      descricao: `Negócio com data de fechamento futura: ${negocio.dataFechamento.toISOString()}`,
      dadosContexto: {
        negocioId: negocio.id,
        dataFechamento: negocio.dataFechamento.toISOString(),
        valorVenda: negocio.valorVenda,
      },
    });
  }

  return anomalias;
}
