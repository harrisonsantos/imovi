/**
 * Schemas zod das entidades da API Vista CRM (portado do ImobCheck (projeto legado absorvido)).
 * Edge-safe: apenas zod, sem dependências de runtime Node.
 */
import { z } from 'zod';

// Schema para resposta da API Vista - Imóvel
export const vistaImovelSchema = z.object({
  Codigo: z.string(),
  Categoria: z.string().optional(),
  Bairro: z.string().optional(),
  Cidade: z.string().optional(),
  ValorVenda: z.number().optional(),
  ValorLocacao: z.number().optional(),
  Dormitorios: z.number().optional(),
  Suites: z.number().optional(),
  Vagas: z.number().optional(),
  AreaTotal: z.number().optional(),
  AreaPrivativa: z.number().optional(),
  CodigoCorretor: z.string().optional(),
  CodigoAgencia: z.string().optional(),
  Status: z.string().optional(),
  Finalidade: z.string().optional(),
  Endereco: z.string().optional(),
  Numero: z.string().optional(),
  Complemento: z.string().optional(),
  Matricula: z.string().optional(),
  Corretor: z
    .object({
      Nome: z.string().optional(),
      'E-mail': z.string().email().optional(),
      Creci: z.string().optional(),
      Fone: z.string().optional(),
    })
    .optional(),
  Agencia: z
    .object({
      Nome: z.string().optional(),
      Fone: z.string().optional(),
      Endereco: z.string().optional(),
      Numero: z.string().optional(),
      Complemento: z.string().optional(),
      Bairro: z.string().optional(),
      Cidade: z.string().optional(),
    })
    .optional(),
});

export type VistaImovel = z.infer<typeof vistaImovelSchema>;

// Schema para resposta da API Vista - Cliente/Lead
export const vistaClienteSchema = z.object({
  Codigo: z.string(),
  Nome: z.string().optional(),
  Email: z.string().email().optional(),
  Telefone: z.string().optional(),
  Celular: z.string().optional(),
  CodigoCorretor: z.string().optional(),
  CodigoImovel: z.string().optional(),
  Origem: z.string().optional(),
  Status: z.string().optional(),
  Observacoes: z.string().optional(),
  DataCadastro: z.string().optional(),
  ValorProposta: z.number().optional(),
});

export type VistaCliente = z.infer<typeof vistaClienteSchema>;

// Schema para resposta da API Vista - Negócio
export const vistaNegocioSchema = z.object({
  Codigo: z.string(),
  CodigoCliente: z.string().optional(),
  CodigoImovel: z.string().optional(),
  CodigoCorretor: z.string().optional(),
  ValorVenda: z.number().optional(),
  ComissaoPercentual: z.number().optional(),
  ComissaoValor: z.number().optional(),
  DataFechamento: z.string().optional(),
  DataEscritura: z.string().optional(),
  Status: z.string().optional(),
  Observacoes: z.string().optional(),
});

export type VistaNegocio = z.infer<typeof vistaNegocioSchema>;

// Schema para requisição de pesquisa Vista
export const vistaPesquisaSchema = z.object({
  fields: z.array(z.union([z.string(), z.record(z.any())])).optional(),
  filter: z.record(z.any()).optional(),
  order: z.record(z.union([z.literal('asc'), z.literal('desc')])).optional(),
  paginacao: z
    .object({
      pagina: z.number().default(1),
      quantidade: z.number().default(50),
    })
    .optional(),
  advFilter: z.any().optional(),
});

export type VistaPesquisa = z.infer<typeof vistaPesquisaSchema>;

// Schema para resposta paginada da API Vista
export const vistaResponseSchema = z.object({
  total: z.number().optional(),
  paginas: z.number().optional(),
  pagina: z.number().optional(),
  quantidade: z.number().optional(),
  data: z.array(z.any()).optional(),
});

export type VistaResponse = z.infer<typeof vistaResponseSchema>;

/** Tipos de evento de webhook do Vista que processamos. */
export const VISTA_EVENT_TYPES = [
  'imovel.criado',
  'imovel.atualizado',
  'lead.criado',
  'lead.atualizado',
  'cliente.criado',
  'cliente.atualizado',
  'negocio.criado',
  'negocio.atualizado',
] as const;

export type VistaEventType = (typeof VISTA_EVENT_TYPES)[number];

// Schema de webhook Vista — event_type restrito aos eventos suportados.
export const vistaWebhookSchema = z.object({
  event_type: z.enum(VISTA_EVENT_TYPES),
  timestamp: z.string().optional(),
  data: z.record(z.any()),
});

export type VistaWebhook = z.infer<typeof vistaWebhookSchema>;
