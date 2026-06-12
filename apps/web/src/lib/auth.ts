/**
 * Instância better-auth (email/senha + organizations), edge-compatible.
 *
 * Construída de forma lazy por request porque DATABASE_URL e BETTER_AUTH_SECRET
 * vêm do env do Cloudflare Pages (getRequestContext().env), não de process.env.
 * O drizzleAdapter aponta para as tabelas de @imovi/db/schema-auth — mesma
 * convenção snake_case do resto do banco.
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
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
import { getDb } from './db.js';

export interface AuthEnv {
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
}

let cached: ReturnType<typeof buildAuth> | null = null;

const TRIAL_DAYS = 14;

function buildAuth(env: AuthEnv) {
  const db = getDb(env.DATABASE_URL);
  const secret = env.BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET;
  const baseURL =
    env.BETTER_AUTH_URL ??
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000';

  return betterAuth({
    ...(secret ? { secret } : {}),
    baseURL,
    emailAndPassword: {
      enabled: true,
      // Verificação de e-mail entra junto com o provedor transacional (F5);
      // o gate de negócio é o trial/status da organization, não o e-mail.
      requireEmailVerification: false,
    },
    // Cast: o better-auth resolve sua própria instância de drizzle-orm (mesma
    // versão 0.36.4, peer-hash diferente no pnpm) — tipos nominalmente
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
          afterCreateOrganization: async ({ organization: org }: {
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
  if (!cached) cached = buildAuth(env);
  return cached;
}
