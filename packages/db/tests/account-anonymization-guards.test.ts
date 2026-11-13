import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { accountRepo, AccountAnonymizationError } from '../src/repositories/members.js';
import {
  accounts,
  members,
  organizations,
  sessions,
  termsAcceptances,
  users,
} from '../src/schema-auth.js';
import { createTestDb, type TestDb } from './setup.js';

let t: TestDb;
const now = new Date('2026-11-11T12:00:00Z');
beforeEach(async () => {
  t = await createTestDb();
  await t.db.insert(users).values({ id: 'u-1', name: 'Ana', email: 'ana@example.com' });
});
afterEach(async () => t.dispose());

describe('limites da anonimização', () => {
  it.each([
    ['past_due', 'sub_1', true],
    ['active', null, false],
    ['past_due', null, false],
  ] as const)('status %s e assinatura %s: bloqueado=%s', async (status, subscription, blocked) => {
    await t.db.insert(organizations).values({
      id: 'org-1',
      name: 'Org',
      status,
      stripeSubscriptionId: subscription,
    });
    await t.db.insert(members).values({
      id: 'm-1',
      organizationId: 'org-1',
      userId: 'u-1',
      role: 'owner',
    });
    const result = accountRepo.anonymize(t.db, 'u-1', now);
    if (blocked) {
      await expect(result).rejects.toThrow(AccountAnonymizationError);
      const [user] = await t.db.select().from(users);
      expect(user?.anonymizedAt).toBeNull();
    } else {
      expect((await result)?.updatedAt).toEqual(now);
    }
  });

  it('reverte cadastro e remoções anteriores se uma remoção falhar', async () => {
    await t.db
      .insert(sessions)
      .values({ id: 's-1', userId: 'u-1', token: 'token', expiresAt: now });
    await t.db
      .insert(accounts)
      .values({ id: 'a-1', userId: 'u-1', accountId: 'u-1', providerId: 'credential' });
    await t.raw.exec(`
      CREATE FUNCTION reject_account_delete() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'forced delete failure'; END; $$;
      CREATE TRIGGER reject_account_delete BEFORE DELETE ON accounts
      FOR EACH ROW EXECUTE FUNCTION reject_account_delete();
    `);
    await expect(accountRepo.anonymize(t.db, 'u-1', now)).rejects.toThrow();
    const [user] = await t.db.select().from(users);
    expect(user).toMatchObject({ name: 'Ana', email: 'ana@example.com', anonymizedAt: null });
    expect(await t.db.select().from(sessions)).toHaveLength(1);
    expect(await t.db.select().from(accounts)).toHaveLength(1);
  });

  it('mantém todos os campos da trilha de aceite intactos', async () => {
    await t.db.insert(termsAcceptances).values({
      userId: 'u-1',
      termsVersion: '2026-07-10',
      privacyVersion: '2026-11-05',
      source: 'signup',
      acceptedAt: new Date('2026-11-05T12:00:00Z'),
    });
    const before = await t.db
      .select()
      .from(termsAcceptances)
      .where(eq(termsAcceptances.userId, 'u-1'));
    await accountRepo.anonymize(t.db, 'u-1', now);
    expect(await t.db.select().from(termsAcceptances)).toEqual(before);
  });
});
