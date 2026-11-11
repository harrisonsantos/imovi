import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: vi.fn(),
  db: vi.fn(),
  close: vi.fn(),
  anonymize: vi.fn(),
  requireSession: vi.fn(),
}));
vi.mock('@/lib/cf-env', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getCfEnv: mocks.env,
}));
vi.mock('@/lib/db', () => ({ getTransactionalDb: mocks.db, getDb: vi.fn() }));
vi.mock('@imovi/db/members', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  accountRepo: { anonymize: mocks.anonymize },
}));
vi.mock('@/lib/session', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireSession: mocks.requireSession,
}));

import { AccountAnonymizationError } from '@imovi/db/members';
import { POST } from '../src/app/api/conta/excluir/route';
import { SessionError } from '../src/lib/session';

function request(body: unknown = { confirm: 'EXCLUIR' }, origin = 'https://imovi.test') {
  return new Request('https://imovi.test/api/conta/excluir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T15:00:00Z'));
  mocks.env.mockResolvedValue({ NEXT_PUBLIC_APP_URL: 'https://imovi.test', DATABASE_URL: 'x' });
  mocks.db.mockReturnValue({ db: { fake: 'db' }, close: mocks.close });
  mocks.requireSession.mockResolvedValue({ userId: 'u-1', activeOrganizationId: null });
  mocks.anonymize.mockResolvedValue({ anonymizedAt: new Date('2026-11-10T12:00:00Z') });
});
afterEach(() => vi.useRealTimers());

describe('POST /api/conta/excluir', () => {
  it('anonimiza apenas o usuário da sessão e retorna a data persistida', async () => {
    const res = await POST(request({ confirm: 'EXCLUIR', userId: 'outro' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, anonymizedAt: '2026-11-10T12:00:00.000Z' });
    expect(mocks.anonymize).toHaveBeenCalledWith(
      { fake: 'db' },
      'u-1',
      new Date('2026-11-11T15:00:00Z'),
    );
    expect(mocks.db).toHaveBeenCalledWith('x');
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it.each([
    null,
    {},
    [],
    'EXCLUIR',
    { confirm: false },
    { confirm: 'excluir' },
    { confirm: ' EXCLUIR ' },
  ])('recusa confirmação inválida: %j', async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.anonymize).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
  });

  it.each(['', '{'])('recusa corpo ausente ou JSON malformado', async (body) => {
    const req = new Request('https://imovi.test/api/conta/excluir', {
      method: 'POST',
      headers: { origin: 'https://imovi.test' },
      body,
    });
    expect((await POST(req)).status).toBe(400);
    expect(mocks.anonymize).not.toHaveBeenCalled();
  });

  it('recusa origem externa antes de acessar sessão ou banco', async () => {
    expect((await POST(request({ confirm: 'EXCLUIR' }, 'https://evil.test'))).status).toBe(403);
    expect(mocks.requireSession).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
  });

  it('exige sessão ativa', async () => {
    mocks.requireSession.mockRejectedValueOnce(new SessionError(401, 'unauthorized', 'x'));
    expect((await POST(request())).status).toBe(401);
    expect(mocks.anonymize).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
  });

  it('retorna 409 quando é o único owner com assinatura ativa', async () => {
    mocks.anonymize.mockRejectedValueOnce(new AccountAnonymizationError());
    const res = await POST(request());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'active_subscription_owner' });
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('recusa usuário inexistente sem informar sucesso', async () => {
    mocks.anonymize.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('propaga falhas inesperadas e encerra a conexão', async () => {
    mocks.anonymize.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(POST(request())).rejects.toThrow('database unavailable');
    expect(mocks.close).toHaveBeenCalledOnce();
  });
});
