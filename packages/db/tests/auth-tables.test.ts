import { readFile } from 'node:fs/promises';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { users, organizations, members, invitations, billingEvents } from '../src/schema-auth.js';
import { createTestDb, type TestDb } from './setup.js';

describe('tabelas de auth (better-auth + organizations)', () => {
  let t: TestDb;

  beforeEach(async () => {
    t = await createTestDb();
  });

  afterEach(async () => {
    await t.dispose();
  });

  it('cria organization com defaults de negócio (plan=trial, status=trial)', async () => {
    const [org] = await t.db
      .insert(organizations)
      .values({ id: 'org-1', name: 'Imobiliária Alfa', slug: 'alfa' })
      .returning();

    expect(org!.plan).toBe('trial');
    expect(org!.status).toBe('trial');
    expect(org!.maxCorretores).toBeNull();
    expect(org!.trialEndsAt).toBeNull();
    expect(org!.stripeCustomerId).toBeNull();
    expect(org!.stripeSubscriptionId).toBeNull();
    expect(org!.cancelAtPeriodEnd).toBe(false);
  });

  it('billing event id é único para idempotência de webhook', async () => {
    await t.db.insert(billingEvents).values({ id: 'evt_1', type: 'invoice.paid' });
    await expect(
      t.db.insert(billingEvents).values({ id: 'evt_1', type: 'invoice.paid' }),
    ).rejects.toThrow();
  });

  it('member liga user a organization e respeita unique (org, user)', async () => {
    await t.db.insert(users).values({ id: 'u-1', name: 'Ana', email: 'ana@alfa.com' });
    await t.db
      .insert(organizations)
      .values({ id: 'org-1', name: 'Alfa', slug: 'alfa' });

    await t.db
      .insert(members)
      .values({ id: 'm-1', organizationId: 'org-1', userId: 'u-1', role: 'owner' });

    // Duplicata (mesma org, mesmo user) deve violar o unique index
    await expect(
      t.db
        .insert(members)
        .values({ id: 'm-2', organizationId: 'org-1', userId: 'u-1', role: 'member' }),
    ).rejects.toThrow();

    const rows = await t.db
      .select()
      .from(members)
      .where(eq(members.organizationId, 'org-1'));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.role).toBe('owner');
  });

  it('email de user é único', async () => {
    await t.db.insert(users).values({ id: 'u-1', name: 'Ana', email: 'ana@alfa.com' });
    await expect(
      t.db.insert(users).values({ id: 'u-2', name: 'Outra', email: 'ana@alfa.com' }),
    ).rejects.toThrow();
  });

  it('deletar organization cascateia members', async () => {
    await t.db.insert(users).values({ id: 'u-1', name: 'Ana', email: 'a@a.com' });
    await t.db.insert(organizations).values({ id: 'org-1', name: 'Alfa', slug: 'alfa' });
    await t.db
      .insert(members)
      .values({ id: 'm-1', organizationId: 'org-1', userId: 'u-1', role: 'owner' });

    await t.db.delete(organizations).where(eq(organizations.id, 'org-1'));

    const rows = await t.db.select().from(members);
    expect(rows).toHaveLength(0);
  });

  it('migration 0011 preenche invitations.created_at em linhas existentes e é idempotente', async () => {
    const prod = await readFile(
      new URL('../migrations/0011_invitation_created_at.sql', import.meta.url),
      'utf8',
    );
    const pglite = await readFile(
      new URL('../migrations/0011_invitation_created_at_pglite.sql', import.meta.url),
      'utf8',
    );
    expect(pglite).toBe(prod);

    const legacy = await createTestDb({ through: 8 });
    try {
      await legacy.db.insert(users).values({ id: 'u-1', name: 'Ana', email: 'a@a.com' });
      await legacy.db
        .insert(organizations)
        .values({ id: 'org-1', name: 'Alfa', slug: 'alfa' });
      await legacy.raw.query(
        `INSERT INTO invitations (id, organization_id, email, role, status, expires_at, inviter_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['inv-1', 'org-1', 'convidado@alfa.com', 'member', 'pending', new Date(Date.now() + 86_400_000), 'u-1'],
      );
      await legacy.raw.exec(prod);
      await legacy.raw.exec(prod);
      const rows = await legacy.db
        .select()
        .from(invitations)
        .where(eq(invitations.id, 'inv-1'));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.createdAt).toBeInstanceOf(Date);
    } finally {
      await legacy.dispose();
    }
  });
});
