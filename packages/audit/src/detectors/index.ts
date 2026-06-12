/**
 * Detectores de anomalia da auditoria (fase 4) — funções puras + orquestrador.
 */
export type { DetectedAnomalia, Severidade } from './types.js';
export { detectLeadPerdidoRapido } from './lead-perdido-rapido.js';
export {
  calcularTaxaConversao,
  detectTaxaConversaoBaixa,
  type CorretorStats,
} from './taxa-conversao-baixa.js';
export { detectVendaNaoRegistrada } from './venda-nao-registrada.js';
export { detectLeadInativo } from './lead-inativo.js';
export { detectNegocioDataFutura } from './negocio-data-futura.js';
export {
  detectDesvioAvm,
  type DesvioAvmOpts,
  type NegocioComImovelRef,
  type NeighborhoodRef,
} from './desvio-avm.js';
export {
  runDetectors,
  type RunDetectorsOpts,
  type RunDetectorsResult,
} from './run-detectors.js';
