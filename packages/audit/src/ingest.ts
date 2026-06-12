/**
 * Ingestão de eventos do Vista CRM (webhook) — multi-tenant, escopada por org.
 *
 * Portado do legado imobcheck/app/api/webhooks/vista/route.ts, trocando o
 * client Supabase pelos repositórios drizzle de @imovi/db/audit.
 *
 * Regras (espelham o legado):
 *   - imovel.*  → upsert do imóvel; auto-cria/atualiza corretor se o payload
 *                 trouxer dados do corretor (Creci ou CodigoCorretor + Nome).
 *   - lead.* / cliente.* → upsert do lead; vincula corretor/imóvel existentes
 *                 por vista_user_id / vista_id (sem auto-criar sem nome).
 *   - negocio.* → upsert do negócio; vincula corretor/imóvel/lead por vista id.
 *   - TODO evento (mesmo sem Codigo) é registrado em audit_eventos.
 */
import { and, eq } from '@imovi/db/operators';
import { auditCorretores, auditLeads } from '@imovi/db/schema-audit';
import {
  auditCorretoresRepo,
  auditImoveisRepo,
  auditLeadsRepo,
  auditNegociosRepo,
  auditEventosRepo,
} from '@imovi/db/audit';
import type { AnyDbClient } from '@imovi/db';
import type { AuditEvento } from '@imovi/db/schema-audit';
import type { VistaWebhook } from './vista/types.js';

/** Dados crus do webhook — campos acessados defensivamente. */
type Dados = Record<string, unknown>;

function asStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function asNumStr(v: unknown): string | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return String(v);
}

function asDate(v: unknown): Date | null {
  const s = asStr(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Busca id do corretor da org pelo vista_user_id (sem auto-criar). */
async function findCorretorIdByVistaUserId(
  db: AnyDbClient,
  orgId: string,
  vistaUserId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: auditCorretores.id })
    .from(auditCorretores)
    .where(and(eq(auditCorretores.orgId, orgId), eq(auditCorretores.vistaUserId, vistaUserId)))
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * Resolve (e auto-cria, quando possível) o corretor a partir do payload de imóvel.
 * Prioridade: Creci (chave de negócio) > vista_user_id com nome > lookup puro.
 */
async function resolveCorretorFromImovel(
  db: AnyDbClient,
  orgId: string,
  data: Dados,
): Promise<string | null> {
  const corretor = (data.Corretor ?? {}) as Dados;
  const creci = asStr(corretor.Creci);
  const nome = asStr(corretor.Nome);
  const email = asStr(corretor['E-mail']);
  const vistaUserId = asStr(data.CodigoCorretor);

  if (creci && nome) {
    const row = await auditCorretoresRepo.upsertByCreci(db, orgId, {
      nome,
      email,
      creci,
      vistaUserId,
    });
    return row.id;
  }
  if (vistaUserId && nome) {
    const row = await auditCorretoresRepo.upsertByVistaUserId(db, orgId, {
      nome,
      email,
      creci,
      vistaUserId,
    });
    return row.id;
  }
  if (vistaUserId) {
    return findCorretorIdByVistaUserId(db, orgId, vistaUserId);
  }
  return null;
}

async function processarImovel(db: AnyDbClient, orgId: string, data: Dados): Promise<void> {
  const vistaId = asStr(data.Codigo);
  if (!vistaId) return;

  const corretorId = await resolveCorretorFromImovel(db, orgId, data);

  // Endereço completo a partir das partes disponíveis.
  const endereco =
    [data.Endereco, data.Numero, data.Complemento, data.Bairro, data.Cidade]
      .map(asStr)
      .filter(Boolean)
      .join(', ') || null;

  await auditImoveisRepo.upsertByVistaId(db, orgId, {
    vistaId,
    corretorId,
    endereco: endereco ?? asStr(data.Endereco),
    tipo: asStr(data.Categoria),
    valor: asNumStr(data.ValorVenda) ?? asNumStr(data.ValorLocacao),
    matricula: asStr(data.Matricula),
    status: asStr(data.Status)?.toLowerCase() ?? 'ativo',
  });
}

async function processarLead(db: AnyDbClient, orgId: string, data: Dados): Promise<void> {
  const vistaId = asStr(data.Codigo);
  if (!vistaId) return;

  const codigoCorretor = asStr(data.CodigoCorretor);
  const corretorId = codigoCorretor
    ? await findCorretorIdByVistaUserId(db, orgId, codigoCorretor)
    : null;

  const codigoImovel = asStr(data.CodigoImovel);
  const imovel = codigoImovel
    ? await auditImoveisRepo.findByVistaId(db, orgId, codigoImovel)
    : null;

  await auditLeadsRepo.upsertByVistaId(db, orgId, {
    vistaId,
    corretorId,
    imovelId: imovel?.id ?? null,
    nome: asStr(data.Nome),
    email: asStr(data.Email),
    telefone: asStr(data.Telefone) ?? asStr(data.Celular),
    origem: asStr(data.Origem)?.toLowerCase() ?? null,
    status: asStr(data.Status)?.toLowerCase() ?? 'novo',
    valorProposta: asNumStr(data.ValorProposta),
  });
}

async function processarNegocio(db: AnyDbClient, orgId: string, data: Dados): Promise<void> {
  const vistaId = asStr(data.Codigo);
  if (!vistaId) return;

  const codigoCorretor = asStr(data.CodigoCorretor);
  const corretorId = codigoCorretor
    ? await findCorretorIdByVistaUserId(db, orgId, codigoCorretor)
    : null;

  const codigoImovel = asStr(data.CodigoImovel);
  const imovel = codigoImovel
    ? await auditImoveisRepo.findByVistaId(db, orgId, codigoImovel)
    : null;

  // CodigoCliente do negócio referencia o lead (cliente) no Vista.
  const codigoCliente = asStr(data.CodigoCliente);
  let leadId: string | null = null;
  if (codigoCliente) {
    const rows = await db
      .select({ id: auditLeads.id })
      .from(auditLeads)
      .where(and(eq(auditLeads.orgId, orgId), eq(auditLeads.vistaId, codigoCliente)))
      .limit(1);
    leadId = rows[0]?.id ?? null;
  }

  await auditNegociosRepo.upsertByVistaId(db, orgId, {
    vistaId,
    corretorId,
    imovelId: imovel?.id ?? null,
    leadId,
    valorVenda: asNumStr(data.ValorVenda),
    comissaoPercentual: asNumStr(data.ComissaoPercentual),
    comissaoValor: asNumStr(data.ComissaoValor),
    dataFechamento: asDate(data.DataFechamento),
    dataEscritura: asDate(data.DataEscritura),
    status: asStr(data.Status)?.toLowerCase() ?? 'pendente',
    observacoes: asStr(data.Observacoes),
  });
}

/**
 * Processa um evento de webhook do Vista para a org informada e registra
 * o evento bruto em audit_eventos. Retorna o evento registrado.
 */
export async function processVistaEvent(
  db: AnyDbClient,
  orgId: string,
  payload: VistaWebhook,
): Promise<AuditEvento> {
  switch (payload.event_type) {
    case 'imovel.criado':
    case 'imovel.atualizado':
      await processarImovel(db, orgId, payload.data);
      break;
    case 'lead.criado':
    case 'lead.atualizado':
    case 'cliente.criado':
    case 'cliente.atualizado':
      await processarLead(db, orgId, payload.data);
      break;
    case 'negocio.criado':
    case 'negocio.atualizado':
      await processarNegocio(db, orgId, payload.data);
      break;
  }

  // Log append-only do evento bruto (mesmo quando o payload é incompleto).
  return auditEventosRepo.record(db, orgId, {
    tipo: payload.event_type,
    fonte: 'vista_webhook',
    dados: payload,
  });
}
