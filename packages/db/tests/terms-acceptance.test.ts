import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { users } from '../src/schema-auth.js';
import { termsRepo } from '../src/repositories/members.js';
import { createTestDb, type TestDb } from './setup.js';

let t: TestDb;
beforeEach(async () => {
  t = await createTestDb();
  await t.db.insert(users).values({ id: 'u-1', name: 'Ana', email: 'ana@alfa.com' });
});
afterEach(async () => {
  await t.dispose();
});

const acceptance = {
  userId: 'u-1',
  termsVersion: '2026-07-10',
  privacyVersion: '2026-09-30',
  source: 'auditoria_cadastro',
};

describe('termsRepo — trilha de aceite dos termos', () => {
  it('grava versão dos termos, versão da privacidade e data/hora do aceite por usuário', async () => {
    const at = new Date('2026-11-05T12:00:00Z');
    const row = await termsRepo.record(t.db, { ...acceptance, acceptedAt: at });
    expect(row).toMatchObject({
      userId: 'u-1',
      termsVersion: '2026-07-10',
      privacyVersion: '2026-09-30',
      source: 'auditoria_cadastro',
    });
    expect(row.acceptedAt.toISOString()).toBe(at.toISOString());
    expect(await termsRepo.hasAccepted(t.db, 'u-1', '2026-07-10')).toBe(true);
    expect(await termsRepo.hasAccepted(t.db, 'u-1', '2026-12-01')).toBe(false);
  });

  it('preserva a data do primeiro aceite quando a mesma versão é aceita de novo', async () => {
    const first = await termsRepo.record(t.db, {
      ...acceptance,
      acceptedAt: new Date('2026-11-05T12:00:00Z'),
    });
    const again = await termsRepo.record(t.db, {
      ...acceptance,
      source: 'signup',
      acceptedAt: new Date('2026-11-06T12:00:00Z'),
    });
    expect(again.id).toBe(first.id);
    expect(again.acceptedAt.toISOString()).toBe('2026-11-05T12:00:00.000Z');
    expect(again.source).toBe('auditoria_cadastro');
  });

  it('mantém o histórico quando uma nova versão dos termos é aceita', async () => {
    await termsRepo.record(t.db, { ...acceptance, acceptedAt: new Date('2026-11-05T12:00:00Z') });
    await termsRepo.record(t.db, {
      ...acceptance,
      termsVersion: '2027-01-15',
      acceptedAt: new Date('2027-01-20T12:00:00Z'),
    });
    const latest = await termsRepo.latest(t.db, 'u-1');
    expect(latest?.termsVersion).toBe('2027-01-15');
    const all = await t.raw.query(
      'SELECT terms_version FROM terms_acceptances ORDER BY accepted_at',
    );
    expect(all.rows).toEqual([{ terms_version: '2026-07-10' }, { terms_version: '2027-01-15' }]);
  });

  it('rejeita aceite de usuário inexistente e impede excluir usuário com aceite registrado', async () => {
    await expect(termsRepo.record(t.db, { ...acceptance, userId: 'fantasma' })).rejects.toThrow();
    await termsRepo.record(t.db, acceptance);
    // A Política promete guardar o aceite pelo prazo prescricional: excluir a
    // conta não pode apagar a trilha em silêncio (ON DELETE RESTRICT).
    await expect(t.db.delete(users).where(eq(users.id, 'u-1'))).rejects.toThrow();
    expect(await termsRepo.hasAccepted(t.db, 'u-1', '2026-07-10')).toBe(true);
    const fk = await t.raw.query<{ confdeltype: string }>(
      `SELECT confdeltype FROM pg_constraint
       WHERE conrelid = 'terms_acceptances'::regclass AND contype = 'f'`,
    );
    expect(fk.rows).toEqual([{ confdeltype: 'r' }]);
  });

  it('migration 0008 é idempotente e tem variante pglite idêntica à de produção', async () => {
    const prod = await readFile(
      new URL('../migrations/0008_terms_acceptance.sql', import.meta.url),
      'utf8',
    );
    const pglite = await readFile(
      new URL('../migrations/0008_terms_acceptance_pglite.sql', import.meta.url),
      'utf8',
    );
    expect(pglite).toBe(prod);
    await t.raw.exec(prod);
    await termsRepo.record(t.db, acceptance);
    await t.raw.exec(prod);
    expect(await termsRepo.hasAccepted(t.db, 'u-1', '2026-07-10')).toBe(true);
  });
});
