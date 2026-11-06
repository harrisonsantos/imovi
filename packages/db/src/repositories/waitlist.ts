import { eq } from 'drizzle-orm';
import { waitlistContacts } from '../schema.js';
import type { AnyDbClient } from './types.js';

export const waitlistRepo = {
  async register(
    db: AnyDbClient,
    input: { email: string; source: string; consentVersion: string },
  ): Promise<{ id: string }> {
    const email = input.email.trim().toLowerCase();
    const [created] = await db
      .insert(waitlistContacts)
      .values({ ...input, email })
      .onConflictDoNothing({ target: waitlistContacts.email })
      .returning({ id: waitlistContacts.id });
    if (created) return created;
    const [existing] = await db
      .select({ id: waitlistContacts.id })
      .from(waitlistContacts)
      .where(eq(waitlistContacts.email, email))
      .limit(1);
    if (!existing) throw new Error('Waitlist persistence unavailable');
    return existing;
  },
};
