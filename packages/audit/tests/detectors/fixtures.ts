/**
 * Fábricas de fixtures sintéticas para os testes dos detectores.
 *
 * Produzem linhas no formato exato dos tipos `$inferSelect` do Drizzle
 * (campos numeric são string | null; timestamps são Date).
 */
import type {
  AuditImovel,
  AuditLead,
  AuditNegocio,
} from '@imovi/db/schema-audit';

let seq = 0;
/** Gera um id determinístico-ish por execução (uuid não é necessário em memória). */
const nextId = (prefix: string): string => `${prefix}-${++seq}`;

export function makeLead(overrides: Partial<AuditLead> = {}): AuditLead {
  const now = new Date();
  return {
    id: nextId('lead'),
    orgId: 'org-teste',
    vistaId: nextId('vista-lead'),
    corretorId: null,
    imovelId: null,
    nome: 'Lead Teste',
    email: null,
    telefone: null,
    origem: null,
    status: 'novo',
    valorProposta: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeImovel(overrides: Partial<AuditImovel> = {}): AuditImovel {
  const now = new Date();
  return {
    id: nextId('imovel'),
    orgId: 'org-teste',
    vistaId: nextId('vista-imovel'),
    corretorId: null,
    endereco: 'Rua Teste, 123',
    tipo: 'apartamento',
    valor: null,
    matricula: null,
    matriculaVerificada: false,
    status: 'disponivel',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeNegocio(overrides: Partial<AuditNegocio> = {}): AuditNegocio {
  const now = new Date();
  return {
    id: nextId('negocio'),
    orgId: 'org-teste',
    vistaId: nextId('vista-negocio'),
    corretorId: null,
    imovelId: null,
    leadId: null,
    valorVenda: null,
    comissaoPercentual: null,
    comissaoValor: null,
    dataFechamento: null,
    dataEscritura: null,
    status: null,
    observacoes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
