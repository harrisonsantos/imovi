import { and, eq, inArray, isNotNull, ne, or } from 'drizzle-orm';
import {
  accounts,
  invitations,
  members,
  organizations,
  sessions,
  users,
  verifications,
  type Member,
  type User,
} from '../schema-auth.js';
import type { AnyDbClient } from './types.js';

export const memberRepo = {
  async findByUserAndOrg(
    db: AnyDbClient,
    userId: string,
    organizationId: string,
  ): Promise<Member | null> {
    const rows = await db
      .select()
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.organizationId, organizationId)))
      .limit(1);
    return rows[0] ?? null;
  },
};

export class AccountAnonymizationError extends Error {
  constructor() {
    super('Transfira a propriedade ou encerre a assinatura antes de excluir a conta.');
    this.name = 'AccountAnonymizationError';
  }
}

export const accountRepo = {
  async anonymize(db: AnyDbClient, userId: string, now: Date): Promise<User | null> {
    return db.transaction(async (tx) => {
      // Serializa pedidos repetidos para manter o primeiro cadastro anonimizado.
      const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
      if (!user) return null;
      if (user.anonymizedAt) return user;

      // A ordem de locks é estável mesmo quando owners compartilham várias orgs.
      // Outra anonimização deve aguardar e recontar owners após a primeira terminar.
      const subscribedOrgs = await tx
        .select({ id: organizations.id })
        .from(organizations)
        .innerJoin(members, eq(members.organizationId, organizations.id))
        .where(
          and(
            eq(members.userId, userId),
            eq(members.role, 'owner'),
            inArray(organizations.status, ['active', 'past_due']),
            isNotNull(organizations.stripeSubscriptionId),
          ),
        )
        .orderBy(organizations.id)
        .for('update', { of: organizations });

      for (const org of subscribedOrgs) {
        const [otherOwner] = await tx
          .select({ id: members.id })
          .from(members)
          .where(
            and(
              eq(members.organizationId, org.id),
              eq(members.role, 'owner'),
              ne(members.userId, userId),
            ),
          )
          .limit(1);
        if (!otherOwner) throw new AccountAnonymizationError();
      }

      const [anonymized] = await tx
        .update(users)
        .set({
          name: 'Conta removida',
          email: `removido+${crypto.randomUUID()}@invalid`,
          image: null,
          emailVerified: false,
          anonymizedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, userId))
        .returning();

      await tx.delete(sessions).where(eq(sessions.userId, userId));
      await tx.delete(accounts).where(eq(accounts.userId, userId));
      await tx.delete(members).where(eq(members.userId, userId));
      await tx.delete(verifications).where(inArray(verifications.identifier, [user.email, userId]));
      await tx
        .delete(invitations)
        .where(or(eq(invitations.inviterId, userId), eq(invitations.email, user.email)));
      // users.id permanece como referência da trilha imutável de terms_acceptances.
      return anonymized ?? null;
    });
  },
};

// Exposto por este módulo de identidade para não criar um novo subpath em
// package.json: `@imovi/db/members` já é o ponto de entrada dos dados do usuário.
export { termsRepo, type TermsAcceptanceInput } from './terms.js';
