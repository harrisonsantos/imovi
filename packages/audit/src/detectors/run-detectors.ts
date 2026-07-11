/**
 * Orquestrador dos detectores de anomalia (fase 4 da auditoria).
 *
 * Busca as linhas da org via repositórios, roda os 6 detectores puros e
 * persiste via `auditAnomaliasRepo.insertMany` (que deduplica anomalias
 * NÃO resolvidas por (org, tipo, entidadeId)).
 *
 * Os bairros do AVM chegam por injeção (`fetchNeighborhoods`) para manter
 * este pacote desacoplado do repositório do estimador.
 */
import type { AnyDbClient } from '@imovi/db';
import {
  auditAnomaliasRepo,
  auditCorretoresRepo,
  auditImoveisRepo,
  auditLeadsRepo,
  auditNegociosRepo,
} from '@imovi/db/audit';
import { detectDesvioAvm, type NeighborhoodRef } from './desvio-avm.js';
import { detectLeadInativo } from './lead-inativo.js';
import { detectLeadPerdidoRapido } from './lead-perdido-rapido.js';
import { detectNegocioDataFutura } from './negocio-data-futura.js';
import {
  detectTaxaConversaoBaixa,
  type CorretorStats,
} from './taxa-conversao-baixa.js';
import { detectVendaNaoRegistrada } from './venda-nao-registrada.js';
import type { DetectedAnomalia } from './types.js';

export interface RunDetectorsOpts {
  /** Instante de referência das comparações temporais (default: agora). */
  now?: Date;
  /** Limiar percentual do desvio AVM (default: 25). */
  deviationPct?: number;
  /** Injeção dos bairros AVM; quando ausente, o detector desvio_avm é pulado. */
  fetchNeighborhoods?: () => Promise<NeighborhoodRef[]>;
}

export interface RunDetectorsResult {
  /** Total de anomalias detectadas nesta execução. */
  detected: number;
  /** Quantas foram de fato inseridas (após dedupe do repositório). */
  inserted: number;
}

export async function runDetectors(
  db: AnyDbClient,
  orgId: string,
  opts: RunDetectorsOpts = {},
): Promise<RunDetectorsResult> {
  const now = opts.now ?? new Date();
  const deviationPct = opts.deviationPct ?? 25;

  const [leads, imoveis, negocios, corretores, negociosComImovel, neighborhoods] =
    await Promise.all([
      auditLeadsRepo.listByOrg(db, orgId),
      auditImoveisRepo.listByOrg(db, orgId),
      auditNegociosRepo.listByOrg(db, orgId),
      auditCorretoresRepo.listByOrg(db, orgId),
      auditNegociosRepo.listClosedWithImovel(db, orgId, new Date(0)),
      opts.fetchNeighborhoods?.() ?? Promise.resolve([] as NeighborhoodRef[]),
    ]);

  // Estatísticas por corretor ativo (agregação em memória — porta de patterns.ts).
  const stats: CorretorStats[] = corretores
    .filter((c) => c.ativo !== false)
    .map((c) => ({
      corretorId: c.id,
      totalLeads: leads.filter((l) => l.corretorId === c.id).length,
      totalNegocios: negocios.filter(
        (n) => n.corretorId === c.id && n.status === 'concluído',
      ).length,
    }));

  const anomalias: DetectedAnomalia[] = [
    ...detectLeadPerdidoRapido(leads, now),
    ...detectTaxaConversaoBaixa(stats),
    ...detectVendaNaoRegistrada(imoveis, negocios),
    ...detectLeadInativo(leads, now),
    ...detectNegocioDataFutura(negocios, now),
    ...detectDesvioAvm(negociosComImovel, neighborhoods, { deviationPct }),
  ];

  const inserted = await auditAnomaliasRepo.insertMany(db, orgId, anomalias);

  return { detected: anomalias.length, inserted: inserted.length };
}
