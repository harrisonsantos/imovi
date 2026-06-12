/**
 * Detector: imóvel com status "vendido" sem nenhum negócio correspondente.
 *
 * Portado de imobcheck/lib/detectors/anomaly-detector.ts (caso 3) como
 * função pura — o cruzamento imóvel × negócio é feito em memória.
 */
import type { AuditImovel, AuditNegocio } from '@imovi/db/schema-audit';
import type { DetectedAnomalia } from './types.js';

export function detectVendaNaoRegistrada(
  imoveis: AuditImovel[],
  negocios: AuditNegocio[],
): DetectedAnomalia[] {
  // Set para lookup O(1) — evita varrer negócios por imóvel.
  const imoveisComNegocio = new Set(
    negocios.map((n) => n.imovelId).filter((id): id is string => id != null),
  );

  const anomalias: DetectedAnomalia[] = [];
  for (const imovel of imoveis) {
    if (imovel.status !== 'vendido') continue;
    if (imoveisComNegocio.has(imovel.id)) continue;

    anomalias.push({
      tipo: 'venda_nao_registrada',
      severidade: 'alta',
      corretorId: imovel.corretorId,
      entidadeTipo: 'imovel',
      entidadeId: imovel.id,
      descricao: `Imóvel ${imovel.endereco ?? imovel.vistaId} marcado como vendido sem negócio registrado`,
      dadosContexto: {
        imovelId: imovel.id,
        vistaId: imovel.vistaId,
      },
    });
  }

  return anomalias;
}
