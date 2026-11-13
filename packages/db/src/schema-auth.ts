/**
 * Tabelas de autenticação e organizações (better-auth + plugin organization).
 *
 * Os nomes de campo seguem o contrato do better-auth v1.6 (ids `text`
 * gerados pela lib, não uuid). Colunas extras de negócio ficam em
 * `organizations`: plan/status/maxCorretores/trialEndsAt controlam o gate
 * de monetização do módulo de auditoria.
 */
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    anonymizedAt: timestamp('anonymized_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUx: uniqueIndex('users_email_ux').on(t.email),
  }),
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    activeOrganizationId: text('active_organization_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenUx: uniqueIndex('sessions_token_ux').on(t.token),
    userIdx: index('sessions_user_idx').on(t.userId),
  }),
);

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('accounts_user_idx').on(t.userId),
  }),
);

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    identifierIdx: index('verifications_identifier_idx').on(t.identifier),
  }),
);

export const organizations = pgTable(
  'organizations',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug'),
    logo: text('logo'),
    metadata: text('metadata'),
    // Campos de negócio do módulo de auditoria (gate de monetização)
    plan: text('plan').notNull().default('trial'),
    status: text('status').notNull().default('trial'),
    maxCorretores: integer('max_corretores'),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    subscriptionCurrentPeriodEnd: timestamp('subscription_current_period_end', {
      withTimezone: true,
    }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    billingUpdatedAt: timestamp('billing_updated_at', { withTimezone: true }),
    billingLastEventCreatedAt: timestamp('billing_last_event_created_at', { withTimezone: true }),
    billingLeaseToken: text('billing_lease_token'),
    billingLeaseExpiresAt: timestamp('billing_lease_expires_at', { withTimezone: true }),
    billingCheckoutToken: text('billing_checkout_token'),
    billingCheckoutPlanId: text('billing_checkout_plan_id'),
    billingCheckoutSessionId: text('billing_checkout_session_id'),
    billingCheckoutExpiresAt: timestamp('billing_checkout_expires_at', { withTimezone: true }),
    billingCheckoutRequest: jsonb('billing_checkout_request').$type<Record<string, string>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugUx: uniqueIndex('organizations_slug_ux').on(t.slug),
    stripeCustomerUx: uniqueIndex('organizations_stripe_customer_ux').on(t.stripeCustomerId),
    stripeSubscriptionUx: uniqueIndex('organizations_stripe_subscription_ux').on(
      t.stripeSubscriptionId,
    ),
  }),
);

/** Eventos Stripe já consumidos; impede efeitos duplicados em retries. */
export const billingEvents = pgTable('billing_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>(),
  status: text('status').notNull().default('pending'),
  leaseToken: text('lease_token'),
  leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});

export const members = pgTable(
  'members',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgUserUx: uniqueIndex('members_org_user_ux').on(t.organizationId, t.userId),
    userIdx: index('members_user_idx').on(t.userId),
  }),
);

export const invitations = pgTable(
  'invitations',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role'),
    status: text('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('invitations_org_idx').on(t.organizationId),
    emailIdx: index('invitations_email_idx').on(t.email),
  }),
);

/**
 * Trilha de aceite dos Termos de uso e da Política de privacidade (0008).
 * Uma linha por usuário e versão dos termos; versões novas acumulam histórico.
 */
export const termsAcceptances = pgTable(
  'terms_acceptances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // restrict: excluir a conta não pode apagar a trilha de aceite.
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    termsVersion: text('terms_version').notNull(),
    privacyVersion: text('privacy_version').notNull(),
    source: text('source').notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userVersionUx: uniqueIndex('terms_acceptances_user_version_ux').on(t.userId, t.termsVersion),
  }),
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type BillingEvent = typeof billingEvents.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type TermsAcceptance = typeof termsAcceptances.$inferSelect;
