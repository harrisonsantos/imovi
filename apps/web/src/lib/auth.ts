/**
 * Instância better-auth (email/senha + organizations), edge-compatible.
 *
 * Construída de forma lazy por request porque DATABASE_URL e BETTER_AUTH_SECRET
 * vêm do env do Worker OpenNext (getCloudflareContext().env), não de process.env.
 * O drizzleAdapter aponta para as tabelas de @imovi/db/schema-auth — mesma
 * convenção snake_case do resto do banco.
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { organization } from 'better-auth/plugins';
import {
  users,
  sessions,
  accounts,
  verifications,
  organizations,
  members,
  invitations,
} from '@imovi/db/schema-auth';
import { isProductionEnv } from './cf-env.js';
import { getDb } from './db.js';
import {
  assertSignupTermsAccepted,
  recordSignupAcceptance,
  requireCurrentTermsAcceptance,
} from './terms.js';

export interface AuthEnv {
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  NODE_ENV?: string;
  NEXT_PUBLIC_APP_ENV?: string;
}

let cached: { key: string; auth: ReturnType<typeof buildAuth> } | null = null;

export class AuthConfigurationError extends Error {}

export async function sendVerificationEmail(
  env: AuthEnv,
  email: string,
  url: string,
): Promise<void> {
  const key = env.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
  const from = env.EMAIL_FROM ?? process.env.EMAIL_FROM;
  if (!key || !from) throw new AuthConfigurationError('Envio de e-mail indisponível.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Confirme seu e-mail no Imovi',
      text: `Confirme seu e-mail para acessar a Auditoria: ${url}\nSe você não criou esta conta, ignore esta mensagem.`,
    }),
  });
  if (!response.ok) throw new Error('Não foi possível enviar a confirmação.');
}

const TRIAL_DAYS = 14;

function buildAuth(env: AuthEnv) {
  const secret = env.BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET;
  const baseURL =
    env.BETTER_AUTH_URL ??
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000';

  const production = isProductionEnv(env);
  if (
    production &&
    (!secret ||
      secret.length < 32 ||
      !baseURL.startsWith('https://') ||
      !(env.BETTER_AUTH_URL ?? process.env.BETTER_AUTH_URL) ||
      !(env.DATABASE_URL ?? process.env.DATABASE_URL) ||
      !(env.RESEND_API_KEY ?? process.env.RESEND_API_KEY) ||
      !(env.EMAIL_FROM ?? process.env.EMAIL_FROM))
  ) {
    throw new AuthConfigurationError('Autenticação não configurada.');
  }
  const db = getDb(env.DATABASE_URL);

  return betterAuth({
    ...(secret ? { secret } : {}),
    baseURL,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: production,
      autoSignIn: !production,
    },
    // Cadastro só com aceite da versão vigente dos Termos e da Privacidade.
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-up/email') assertSignupTermsAccepted(ctx.body);
      }),
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user, ctx) => {
            // O hook acima já validou o aceite deste cadastro. Falha aqui não
            // desfaz a conta: a criação da imobiliária volta a exigir o aceite.
            if (ctx?.path !== '/sign-up/email') return;
            await recordSignupAcceptance(db, user.id).catch(() => undefined);
          },
        },
      },
    },
    emailVerification: {
      sendOnSignUp: production,
      sendOnSignIn: production,
      sendVerificationEmail: async ({ user, url }) => sendVerificationEmail(env, user.email, url),
    },
    // Cast: o better-auth resolve sua própria instância de drizzle-orm (mesma
    // versão, peer-hash diferente no pnpm) — tipos nominalmente
    // incompatíveis, estrutural e runtime idênticos.
    database: drizzleAdapter(db as Parameters<typeof drizzleAdapter>[0], {
      provider: 'pg',
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        organization: organizations,
        member: members,
        invitation: invitations,
      } as never,
    }),
    plugins: [
      organization({
        // Toda org nova nasce em trial de 14 dias (gate de monetização F8a).
        organizationHooks: {
          beforeCreateOrganization: async ({ user }) => {
            if (production && !user.emailVerified) throw new Error('Confirme seu e-mail primeiro.');
            await requireCurrentTermsAcceptance(db, user.id);
          },
          afterCreateOrganization: async ({
            organization: org,
          }: {
            organization: { id: string };
          }) => {
            const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
            const { orgRepo } = await import('@imovi/db/orgs');
            await orgRepo.setTrialEndsAt(db, org.id, trialEndsAt);
          },
        },
      }),
    ],
  });
}

export type AuthInstance = ReturnType<typeof buildAuth>;

export function getAuth(env: AuthEnv = {}): AuthInstance {
  const resolved: AuthEnv = {
    DATABASE_URL: env.DATABASE_URL ?? process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL ?? process.env.BETTER_AUTH_URL,
    RESEND_API_KEY: env.RESEND_API_KEY ?? process.env.RESEND_API_KEY,
    EMAIL_FROM: env.EMAIL_FROM ?? process.env.EMAIL_FROM,
    NODE_ENV: env.NODE_ENV ?? process.env.NODE_ENV,
    NEXT_PUBLIC_APP_ENV: env.NEXT_PUBLIC_APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV,
  };
  const key = JSON.stringify([resolved, process.env.NODE_ENV]);
  if (!cached || cached.key !== key) cached = { key, auth: buildAuth(resolved) };
  return cached.auth;
}
