/**
 * Tipos compartilhados dos detectores de anomalia.
 *
 * `DetectedAnomalia` é estruturalmente compatível com `AuditAnomaliaData`
 * (input de `auditAnomaliasRepo.insertMany`) — os detectores são funções
 * puras e a persistência fica a cargo do orquestrador.
 */

export type Severidade = 'baixa' | 'media' | 'alta';

export interface DetectedAnomalia {
  tipo: string;
  severidade: Severidade;
  /** Corretor associado, quando identificável. */
  corretorId?: string | null;
  /** Tipo da entidade-fonte: 'lead' | 'imovel' | 'negocio' | 'corretor'. */
  entidadeTipo: string;
  /** Id da entidade-fonte — usado no dedupe (org, tipo, entidadeId). */
  entidadeId: string;
  descricao: string;
  dadosContexto: Record<string, unknown>;
}
