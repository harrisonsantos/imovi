/**
 * Helpers de sessão/organização para rotas do módulo de auditoria.
 *
 * `requireSession` valida o cookie de sessão via better-auth; `requireOrg`
 * adicionalmente exige uma organization ativa na sessão e aplica o gate de
 * status (trial expirado / suspended → 403 com código próprio, para o front
 * exibir paywall).
 *
 * Ambos lançam `SessionError`, convertida em Response por `sessionGuard`.
 */
import { orgRepo } from '@imovi/db/orgs';
import type { Organization } from '@imovi/db/schema-auth';
import { getAuth, type AuthEnv } from './auth.js';
import { getDb } from './db.js';
import { apiError } from './errors.js';

export class SessionError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface SessionInfo {
  userId: string;
  email: string;
  activeOrganizationId: string | null;
}

export interface OrgSessionInfo extends SessionInfo {
  org: Organization;
}

type AuthApi = ReturnType<typeof getAuth>;

async function getSessionFromAuth(
  auth: AuthApi,
  headers: Headers,
): Promise<SessionInfo | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const s = session as {
    user: { id: string; email: string };
    session: { activeOrganizationId?: string | null };
  };
  return {
    userId: s.user.id,
    email: s.user.email,
    activeOrganizationId: s.session.activeOrganizationId ?? null,
  };
}

export async function requireSession(
  req: Request,
  env: AuthEnv = {},
): Promise<SessionInfo> {
  const auth = getAuth(env);
  const info = await getSessionFromAuth(auth, req.headers);
  if (!info) {
    throw new SessionError(401, 'unauthorized', 'Sessão inválida ou expirada. Faça login.');
  }
  return info;
}

/** Status de org que permitem acesso ao módulo de auditoria. */
const ACTIVE_STATUSES = new Set(['trial', 'active']);

/**
 * Gate de acesso puro (testável sem better-auth/DB): valida status e trial.
 * Lança SessionError quando o acesso deve ser negado.
 */
export function assertOrgAccess(
  org: Pick<Organization, 'status' | 'trialEndsAt'>,
  now: Date = new Date(),
): void {
  if (!ACTIVE_STATUSES.has(org.status)) {
    throw new SessionError(
      403,
      'subscription_required',
      'Assinatura inativa. Fale com vendas para reativar o módulo de auditoria.',
    );
  }
  if (
    org.status === 'trial' &&
    org.trialEndsAt !== null &&
    org.trialEndsAt.getTime() < now.getTime()
  ) {
    throw new SessionError(
      403,
      'trial_expired',
      'Período de avaliação encerrado. Assine para continuar usando a auditoria.',
    );
  }
}

export async function requireOrg(
  req: Request,
  env: AuthEnv = {},
): Promise<OrgSessionInfo> {
  const session = await requireSession(req, env);
  if (!session.activeOrganizationId) {
    throw new SessionError(
      403,
      'no_organization',
      'Nenhuma organização ativa na sessão. Crie ou selecione uma imobiliária.',
    );
  }

  const db = getDb(env.DATABASE_URL);
  const org = await orgRepo.findById(db, session.activeOrganizationId);
  if (!org) {
    throw new SessionError(403, 'no_organization', 'Organização não encontrada.');
  }

  assertOrgAccess(org);

  return { ...session, org };
}

/** Converte SessionError em Response padronizada; repassa outros erros. */
export function sessionGuard(err: unknown): Response {
  if (err instanceof SessionError) {
    return apiError(err.status, err.code, err.message);
  }
  throw err;
}
