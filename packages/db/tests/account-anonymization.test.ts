import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  accounts,
  invitations,
  members,
  organizations,
  sessions,
  termsAcceptances,
  users,
  verifications,
} from '../src/schema-auth.js';
import {
  AccountAnonymizationError,
  accountRepo,
  termsRepo,
} from '../src/repositories/members.js';
import { createTestDb, type TestDb } from './setup.js';

let t: TestDb;
beforeEach(async () => {
  t = await createTestDb();
  await t.db.insert(users).values([
    {
      id: 'u-1',
      name: 'Ana Silva',
      email: 'ana@alfa.com',
      emailVerified: true,
      image: 'https://imovi.test/avatar/ana.png',
    },
    {
      id: 'u-2',
      name: 'Bruno Costa',
      email: 'bruno@alfa.com',
      emailVerified: true,
    },
  ]);
});
afterEach(async () => {
  await t.dispose();
});

describe('accountRepo.anonymize — exclusão de conta por anonimização (LGPD)', () => {
  it('substitui dados pessoais, apaga sessões/credenciais/tokens/convites/members e preserva terms_acceptances', async () => {
    const acceptedAt1 = new Date('2026-07-10T12:00:00Z');
    const acceptedAt2 = new Date('2026-11-06T12:00:00Z');
    await termsRepo.record(t.db, {
      userId: 'u-1',
      termsVersion: '2026-07-10',
      privacyVersion: '2026-09-30',
      source: 'signup',
      acceptedAt: acceptedAt1,
    });
    await termsRepo.record(t.db, {
      userId: 'u-1',
      termsVersion: '2026-10-01',
      privacyVersion: '2026-11-06',
      source: 'auditoria_cadastro',
      acceptedAt: acceptedAt2,
    });

    const expiresAt = new Date('2026-12-01T00:00:00Z');
    await t.db.insert(sessions).values([
      { id: 's-1', userId: 'u-1', token: 'tok-u1', expiresAt },
      { id: 's-2', userId: 'u-2', token: 'tok-u2', expiresAt },
    ]);
    await t.db.insert(accounts).values([
      {
        id: 'acc-1',
        userId: 'u-1',
        accountId: 'u-1',
        providerId: 'credential',
        password: 'hashed-password-u1',
        accessToken: 'access-u1',
        refreshToken: 'refresh-u1',
      },
      {
        id: 'acc-2',
        userId: 'u-2',
        accountId: 'u-2',
        providerId: 'credential',
        password: 'hashed-password-u2',
      },
    ]);
    await t.db.insert(verifications).values([
      { id: 'v-1', identifier: 'ana@alfa.com', value: 'token-email-ana', expiresAt },
      { id: 'v-2', identifier: 'u-1', value: 'token-id-ana', expiresAt },
      { id: 'v-3', identifier: 'bruno@alfa.com', value: 'token-email-bruno', expiresAt },
    ]);
    await t.db.insert(organizations).values([
      { id: 'org-trial', name: 'Alfa Trial', slug: 'alfa-trial', status: 'trial' },
      {
        id: 'org-compartilhada',
        name: 'Alfa Ativa',
        slug: 'alfa-ativa',
        status: 'active',
        stripeSubscriptionId: 'sub_shared',
      },
    ]);
    await t.db.insert(members).values([
      { id: 'm-1', organizationId: 'org-trial', userId: 'u-1', role: 'owner' },
      { id: 'm-2', organizationId: 'org-compartilhada', userId: 'u-1', role: 'owner' },
      { id: 'm-3', organizationId: 'org-compartilhada', userId: 'u-2', role: 'owner' },
    ]);
    await t.db.insert(invitations).values([
      {
        id: 'inv-1',
        organizationId: 'org-trial',
        email: 'convidado@alfa.com',
        role: 'member',
        inviterId: 'u-1',
        expiresAt,
      },
      {
        id: 'inv-2',
        organizationId: 'org-compartilhada',
        email: 'ana@alfa.com',
        role: 'member',
        inviterId: 'u-2',
        expiresAt,
      },
      {
        id: 'inv-3',
        organizationId: 'org-compartilhada',
        email: 'carla@alfa.com',
        role: 'member',
        inviterId: 'u-2',
        expiresAt,
      },
    ]);

    const now = new Date('2026-11-06T15:30:00Z');
    const result = await accountRepo.anonymize(t.db, 'u-1', now);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('u-1');
    expect(result!.email).toMatch(/^removido\+[0-9a-f-]{36}@invalid$/);
    expect(result!.name).not.toContain('Ana');
    expect(result!.image).toBeNull();
    expect(result!.emailVerified).toBe(false);
    expect(result!.anonymizedAt?.toISOString()).toBe(now.toISOString());

    const [storedUser] = await t.db.select().from(users).where(eq(users.id, 'u-1'));
    expect(storedUser).toMatchObject({
      id: 'u-1',
      name: result!.name,
      email: result!.email,
      image: null,
      emailVerified: false,
    });
    expect(storedUser?.anonymizedAt?.toISOString()).toBe(now.toISOString());

    // Sessões, credenciais, tokens de verificação, convites e vínculos de u-1 foram apagados
    expect(await t.db.select().from(sessions).where(eq(sessions.userId, 'u-1'))).toHaveLength(0);
    expect(await t.db.select().from(accounts).where(eq(accounts.userId, 'u-1'))).toHaveLength(0);
    expect(await t.db.select().from(members).where(eq(members.userId, 'u-1'))).toHaveLength(0);
    expect(await t.db.select().from(verifications)).toEqual([
      expect.objectContaining({ id: 'v-3', identifier: 'bruno@alfa.com' }),
    ]);
    expect(await t.db.select().from(invitations)).toEqual([
      expect.objectContaining({ id: 'inv-3', email: 'carla@alfa.com', inviterId: 'u-2' }),
    ]);

    // Dados do outro usuário permanecem intactos
    expect(await t.db.select().from(sessions).where(eq(sessions.userId, 'u-2'))).toHaveLength(1);
    expect(await t.db.select().from(accounts).where(eq(accounts.userId, 'u-2'))).toHaveLength(1);
    expect(await t.db.select().from(members).where(eq(members.userId, 'u-2'))).toHaveLength(1);

    // Trilha de aceite de u-1 permanece intacta
    const acceptances = await t.db
      .select()
      .from(termsAcceptances)
      .where(eq(termsAcceptances.userId, 'u-1'));
    expect(acceptances).toHaveLength(2);
    expect(await termsRepo.hasAccepted(t.db, 'u-1', '2026-07-10')).toBe(true);
    expect(await termsRepo.hasAccepted(t.db, 'u-1', '2026-10-01')).toBe(true);

    // O e-mail original foi liberado para eventual novo cadastro futuro
    await expect(
      t.db.insert(users).values({ id: 'u-novo', name: 'Ana Nova', email: 'ana@alfa.com' }),
    ).resolves.toBeDefined();
  });

  it('é idempotente: segunda chamada não falha nem altera email, nome ou anonymized_at', async () => {
    const firstAt = new Date('2026-11-06T15:00:00Z');
    const secondAt = new Date('2026-11-07T18:00:00Z');

    const first = await accountRepo.anonymize(t.db, 'u-1', firstAt);
    const second = await accountRepo.anonymize(t.db, 'u-1', secondAt);

    expect(second).toEqual(first);
    const [stored] = await t.db.select().from(users).where(eq(users.id, 'u-1'));
    expect(stored?.email).toBe(first!.email);
    expect(stored?.name).toBe(first!.name);
    expect(stored?.anonymizedAt?.toISOString()).toBe(firstAt.toISOString());

    // Usuário inexistente retorna null sem falhar
    expect(await accountRepo.anonymize(t.db, 'fantasma', firstAt)).toBeNull();
  });

  it('recusa quando o usuário é o único owner de organização com assinatura ativa e reverte a transação', async () => {
    const expiresAt = new Date('2026-12-01T00:00:00Z');
    await t.db.insert(sessions).values({ id: 's-1', userId: 'u-1', token: 'tok-u1', expiresAt });
    await t.db.insert(accounts).values({
      id: 'acc-1',
      userId: 'u-1',
      accountId: 'u-1',
      providerId: 'credential',
      password: 'secret',
    });
    await t.db.insert(organizations).values({
      id: 'org-cobrando',
      name: 'Imobiliária Ativa',
      slug: 'imob-ativa',
      status: 'active',
      stripeCustomerId: 'cus_ativa',
      stripeSubscriptionId: 'sub_ativa',
    });
    await t.db.insert(members).values([
      { id: 'm-owner', organizationId: 'org-cobrando', userId: 'u-1', role: 'owner' },
      { id: 'm-admin', organizationId: 'org-cobrando', userId: 'u-2', role: 'admin' },
    ]);

    await expect(
      accountRepo.anonymize(t.db, 'u-1', new Date('2026-11-06T15:00:00Z')),
    ).rejects.toThrow(AccountAnonymizationError);

    // Nada foi alterado no banco
    const [user] = await t.db.select().from(users).where(eq(users.id, 'u-1'));
    expect(user?.name).toBe('Ana Silva');
    expect(user?.email).toBe('ana@alfa.com');
    expect(user?.anonymizedAt).toBeNull();
    expect(await t.db.select().from(sessions).where(eq(sessions.userId, 'u-1'))).toHaveLength(1);
    expect(await t.db.select().from(accounts).where(eq(accounts.userId, 'u-1'))).toHaveLength(1);
    expect(await t.db.select().from(members).where(eq(members.userId, 'u-1'))).toHaveLength(1);
  });

  it('permite anonimizar único owner quando a assinatura da organização já está suspensa', async () => {
    await t.db.insert(organizations).values({
      id: 'org-suspensa',
      name: 'Imobiliária Suspensa',
      slug: 'imob-suspensa',
      status: 'suspended',
      stripeCustomerId: 'cus_susp',
      stripeSubscriptionId: 'sub_susp',
    });
    await t.db.insert(members).values({
      id: 'm-owner',
      organizationId: 'org-suspensa',
      userId: 'u-1',
      role: 'owner',
    });

    const result = await accountRepo.anonymize(t.db, 'u-1', new Date('2026-11-06T15:00:00Z'));
    expect(result?.anonymizedAt).toBeInstanceOf(Date);
    expect(await t.db.select().from(members).where(eq(members.userId, 'u-1'))).toHaveLength(0);
  });

  it('migration 0010 é idempotente e tem variante pglite idêntica à de produção', async () => {
    const prod = await readFile(
      new URL('../migrations/0010_account_anonymization.sql', import.meta.url),
      'utf8',
    );
    const pglite = await readFile(
      new URL('../migrations/0010_account_anonymization_pglite.sql', import.meta.url),
      'utf8',
    );
    expect(pglite).toBe(prod);
    await t.raw.exec(prod);
    await accountRepo.anonymize(t.db, 'u-1', new Date('2026-11-06T15:00:00Z'));
    await t.raw.exec(prod);
    const [stored] = await t.db.select().from(users).where(eq(users.id, 'u-1'));
    expect(stored?.anonymizedAt).toBeInstanceOf(Date);
  });
});
