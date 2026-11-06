import { and, desc, eq } from 'drizzle-orm';
import { termsAcceptances, type TermsAcceptance } from '../schema-auth.js';
import type { AnyDbClient } from './types.js';

export interface TermsAcceptanceInput {
  userId: string;
  termsVersion: string;
  privacyVersion: string;
  /** Onde o aceite aconteceu, ex.: `signup` ou `auditoria_cadastro`. */
  source: string;
  acceptedAt?: Date;
}

export const termsRepo = {
  /**
   * Registra o aceite. Repetir a mesma versão é idempotente e preserva a data
   * do primeiro aceite; uma versão nova cria outro registro.
   */
  async record(db: AnyDbClient, input: TermsAcceptanceInput): Promise<TermsAcceptance> {
    const [created] = await db
      .insert(termsAcceptances)
      .values({ ...input, acceptedAt: input.acceptedAt ?? new Date() })
      .onConflictDoNothing({ target: [termsAcceptances.userId, termsAcceptances.termsVersion] })
      .returning();
    if (created) return created;
    const [existing] = await db
      .select()
      .from(termsAcceptances)
      .where(
        and(
          eq(termsAcceptances.userId, input.userId),
          eq(termsAcceptances.termsVersion, input.termsVersion),
        ),
      )
      .limit(1);
    if (!existing) throw new Error('Terms acceptance persistence unavailable');
    return existing;
  },

  async hasAccepted(db: AnyDbClient, userId: string, termsVersion: string): Promise<boolean> {
    const rows = await db
      .select({ id: termsAcceptances.id })
      .from(termsAcceptances)
      .where(
        and(eq(termsAcceptances.userId, userId), eq(termsAcceptances.termsVersion, termsVersion)),
      )
      .limit(1);
    return rows.length > 0;
  },

  async latest(db: AnyDbClient, userId: string): Promise<TermsAcceptance | null> {
    const rows = await db
      .select()
      .from(termsAcceptances)
      .where(eq(termsAcceptances.userId, userId))
      .orderBy(desc(termsAcceptances.acceptedAt))
      .limit(1);
    return rows[0] ?? null;
  },
};
