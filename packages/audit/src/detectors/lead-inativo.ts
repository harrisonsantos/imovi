/**
 * Detector: lead "desaparecido" — sem atualização há mais de 30 dias e ainda
 * em status inicial (novo/contatado).
 *
 * Portado de detector legado do ImobCheck (caso 4).
 */
import type { AuditLead } from '@imovi/db/schema-audit';
import type { DetectedAnomalia } from './types.js';

const DIA_MS = 24 * 60 * 60 * 1000;
const LIMITE_DIAS = 30;
const STATUS_INICIAIS = new Set(['novo', 'contatado']);

export function detectLeadInativo(leads: AuditLead[], now: Date): DetectedAnomalia[] {
  const anomalias: DetectedAnomalia[] = [];

  for (const lead of leads) {
    if (lead.status == null || !STATUS_INICIAIS.has(lead.status)) continue;

    const diasInativo = Math.floor((now.getTime() - lead.updatedAt.getTime()) / DIA_MS);
    if (diasInativo <= LIMITE_DIAS) continue;

    anomalias.push({
      tipo: 'lead_inativo',
      severidade: 'baixa',
      corretorId: lead.corretorId,
      entidadeTipo: 'lead',
      entidadeId: lead.id,
      descricao: `Lead ${lead.nome ?? 'sem nome'} sem atualizações há ${diasInativo} dias`,
      dadosContexto: {
        leadId: lead.id,
        diasInativo,
        status: lead.status,
        updatedAt: lead.updatedAt.toISOString(),
      },
    });
  }

  return anomalias;
}
