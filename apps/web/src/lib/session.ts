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
import { memberRepo } from '@imovi/db/members';
import { orgRepo } from '@imovi/db/orgs';
import type { Organization } from '@imovi/db/schema-auth';
import { AuthConfigurationError, getAuth, type AuthEnv } from './auth.js';
import { isProductionEnv } from './cf-env.js';
import { getDb } from './db.js';
import { apiError } from './errors.js';
import { getBillingPlan, type BillingProduct } from './billing.js';

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
  role: string;
}

type AuthApi = ReturnType<typeof getAuth>;

async function getSessionFromAuth(
  auth: AuthApi,
  headers: Headers,
  env: AuthEnv,
): Promise<SessionInfo | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const s = session as {
    user: { id: string; email: string; emailVerified?: boolean };
    session: { activeOrganizationId?: string | null };
  };
  if (isProductionEnv(env) && !s.user.emailVerified) {
    throw new SessionError(403, 'email_unverified', 'Confirme seu e-mail antes de acessar.');
  }
  return {
    userId: s.user.id,
    email: s.user.email,
    activeOrganizationId: s.session.activeOrganizationId ?? null,
  };
}

export async function requireSession(req: Request, env: AuthEnv = {}): Promise<SessionInfo> {
  let auth: AuthApi;
  try {
    auth = getAuth(env);
  } catch (err) {
    if (err instanceof AuthConfigurationError)
      throw new SessionError(503, 'auth_unavailable', err.message);
    throw err;
  }
  const info = await getSessionFromAuth(auth, req.headers, env);
  if (!info) {
    throw new SessionError(401, 'unauthorized', 'Sessão inválida ou expirada. Faça login.');
  }
  return info;
}

/** Status de org que permitem acesso ao módulo de auditoria. */
const ACTIVE_STATUSES = new Set(['trial', 'active', 'past_due']);

export function assertOrgProduct(
  org: { plan?: string },
  requiredProduct: BillingProduct = 'audit',
) {
  // Existing organizations use "trial" until their first paid audit subscription.
  const product =
    org.plan === 'trial' || org.plan === undefined ? 'audit' : getBillingPlan(org.plan)?.product;
  if (product !== requiredProduct) {
    throw new SessionError(403, 'product_required', 'Seu plano não inclui este produto.');
  }
}

/**
 * Gate de acesso puro (testável sem better-auth/DB): valida status e trial.
 * Lança SessionError quando o acesso deve ser negado.
 */
export function assertOrgAccess(
  org: Pick<Organization, 'status' | 'trialEndsAt'> & { plan?: string },
  now: Date = new Date(),
  requiredProduct: BillingProduct = 'audit',
): void {
  assertOrgProduct(org, requiredProduct);
  if (!ACTIVE_STATUSES.has(org.status)) {
    throw new SessionError(
      403,
      'subscription_required',
      'Assinatura inativa. Fale com vendas para reativar o módulo de auditoria.',
    );
  }
  if (
    org.status === 'trial' &&
    ((requiredProduct === 'corretor_pro' && org.trialEndsAt === null) ||
      (org.trialEndsAt !== null && org.trialEndsAt.getTime() <= now.getTime()))
  ) {
    throw new SessionError(
      403,
      'trial_expired',
      'Período de avaliação encerrado. Assine para continuar usando a auditoria.',
    );
  }
}

/** Resolve a organização da sessão sem aplicar o gate de assinatura.
 * Usado por checkout/portal para que um trial expirado ainda consiga pagar.
 */
export async function requireOrgIdentity(req: Request, env: AuthEnv = {}): Promise<OrgSessionInfo> {
  const session = await requireSession(req, env);
  if (!session.activeOrganizationId) {
    throw new SessionError(
      403,
      'no_organization',
      'Nenhuma organização ativa na sessão. Crie ou selecione uma imobiliária.',
    );
  }

  const db = getDb(env.DATABASE_URL);
  const member = await memberRepo.findByUserAndOrg(
    db,
    session.userId,
    session.activeOrganizationId,
  );
  if (!member)
    throw new SessionError(
      403,
      'membership_required',
      'Seu acesso a esta organização foi revogado.',
    );
  const org = await orgRepo.findById(db, session.activeOrganizationId);
  if (!org) {
    throw new SessionError(403, 'no_organization', 'Organização não encontrada.');
  }

  return { ...session, org, role: member.role };
}

export async function requireOrg(req: Request, env: AuthEnv = {}): Promise<OrgSessionInfo> {
  const info = await requireOrgIdentity(req, env);
  assertOrgAccess(info.org);
  return info;
}

/** Converte SessionError em Response padronizada; repassa outros erros. */
export function sessionGuard(err: unknown): Response {
  if (err instanceof SessionError) {
    return apiError(err.status, err.code, err.message);
  }
  throw err;
}

export async function requireOrgAdminIdentity(
  req: Request,
  env: AuthEnv = {},
): Promise<OrgSessionInfo> {
  const info = await requireOrgIdentity(req, env);
  if (!info.role.split(',').some((role) => ['owner', 'admin'].includes(role.trim()))) {
    throw new SessionError(
      403,
      'admin_required',
      'Somente administradores podem realizar esta ação.',
    );
  }
  return info;
}

export async function requireOrgAdmin(req: Request, env: AuthEnv = {}): Promise<OrgSessionInfo> {
  const info = await requireOrgAdminIdentity(req, env);
  assertOrgAccess(info.org);
  return info;
}
