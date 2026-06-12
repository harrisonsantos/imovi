/**
 * Detector: lead marcado como "perdido" em menos de 24h após a criação.
 *
 * Portado de imobcheck/lib/detectors/anomaly-detector.ts (caso 1), agora como
 * função pura sobre as linhas — sem acesso a banco.
 */
import type { AuditLead } from '@imovi/db/schema-audit';
import type { DetectedAnomalia } from './types.js';

const HORA_MS = 60 * 60 * 1000;

export function detectLeadPerdidoRapido(leads: AuditLead[], now: Date): DetectedAnomalia[] {
  const anomalias: DetectedAnomalia[] = [];

  for (const lead of leads) {
    if (lead.status !== 'perdido') continue;
    // Guarda de sanidade: ignora linhas com updated_at no futuro em relação ao corte.
    if (lead.updatedAt.getTime() > now.getTime()) continue;

    const tempoHoras =
      Math.abs(lead.updatedAt.getTime() - lead.createdAt.getTime()) / HORA_MS;
    if (tempoHoras >= 24) continue;

    anomalias.push({
      tipo: 'lead_perdido_rapido',
      severidade: 'media',
      corretorId: lead.corretorId,
      entidadeTipo: 'lead',
      entidadeId: lead.id,
      descricao: `Lead ${lead.nome ?? 'sem nome'} marcado como perdido em menos de 24h (${tempoHoras.toFixed(1)}h)`,
      dadosContexto: {
        leadId: lead.id,
        tempoHoras,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      },
    });
  }

  return anomalias;
}
