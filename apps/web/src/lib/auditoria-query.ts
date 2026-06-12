/**
 * Parsing/validação (zod) dos query params das rotas do dashboard de auditoria.
 *
 * Funções puras (recebem URLSearchParams) para serem testáveis sem o runtime
 * Cloudflare — as rotas edge apenas as invocam.
 */
import { z } from 'zod';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 200;

export interface Pagination {
  limit: number;
  offset: number;
}

const LimitSchema = z.coerce.number().int().min(1).max(MAX_LIMIT);
const OffsetSchema = z.coerce.number().int().min(0);

/** limit/offset com defaults e clamp; valores inválidos caem no default. */
export function parsePagination(params: URLSearchParams): Pagination {
  const limit = LimitSchema.safeParse(params.get('limit') ?? undefined);
  const offset = OffsetSchema.safeParse(params.get('offset') ?? undefined);
  return {
    limit: limit.success ? limit.data : DEFAULT_LIMIT,
    offset: offset.success ? offset.data : 0,
  };
}

/** 'true'/'false' → boolean; ausente ou inválido → undefined (sem filtro). */
export function parseBooleanParam(params: URLSearchParams, name: string): boolean | undefined {
  const raw = params.get(name);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

/** String não vazia (trim); ausente/vazia → undefined (sem filtro). */
export function parseStringParam(params: URLSearchParams, name: string): string | undefined {
  const raw = params.get(name)?.trim();
  return raw ? raw : undefined;
}

export interface AnomaliasQuery extends Pagination {
  resolvida?: boolean;
  tipo?: string;
}

export function parseAnomaliasQuery(params: URLSearchParams): AnomaliasQuery {
  return {
    ...parsePagination(params),
    resolvida: parseBooleanParam(params, 'resolvida'),
    tipo: parseStringParam(params, 'tipo'),
  };
}

export interface LeadsQuery extends Pagination {
  status?: string;
}

export function parseLeadsQuery(params: URLSearchParams): LeadsQuery {
  return {
    ...parsePagination(params),
    status: parseStringParam(params, 'status'),
  };
}
