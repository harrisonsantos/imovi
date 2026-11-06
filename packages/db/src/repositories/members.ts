import { and, eq } from 'drizzle-orm';
import { members, type Member } from '../schema-auth.js';
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

// Exposto por este módulo de identidade para não criar um novo subpath em
// package.json: `@imovi/db/members` já é o ponto de entrada dos dados do usuário.
export { termsRepo, type TermsAcceptanceInput } from './terms.js';
