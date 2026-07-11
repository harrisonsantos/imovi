import { describe, it, expect } from 'vitest';
import { assertOrgAccess, SessionError, sessionGuard } from '../src/lib/session';

const NOW = new Date('2026-06-11T12:00:00Z');

describe('assertOrgAccess (gate de monetização)', () => {
  it('permite org active', () => {
    expect(() =>
      assertOrgAccess({ status: 'active', trialEndsAt: null }, NOW),
    ).not.toThrow();
  });

  it('mantém acesso em past_due para permitir recuperação de pagamento', () => {
    expect(() =>
      assertOrgAccess({ status: 'past_due', trialEndsAt: null }, NOW),
    ).not.toThrow();
  });

  it('permite trial dentro do prazo', () => {
    const trialEndsAt = new Date('2026-06-20T00:00:00Z');
    expect(() => assertOrgAccess({ status: 'trial', trialEndsAt }, NOW)).not.toThrow();
  });

  it('permite trial sem data definida (legado/pré-provisionamento)', () => {
    expect(() =>
      assertOrgAccess({ status: 'trial', trialEndsAt: null }, NOW),
    ).not.toThrow();
  });

  it('bloqueia trial expirado com código trial_expired', () => {
    const trialEndsAt = new Date('2026-06-01T00:00:00Z');
    try {
      assertOrgAccess({ status: 'trial', trialEndsAt }, NOW);
      expect.unreachable('deveria lançar');
    } catch (err) {
      expect(err).toBeInstanceOf(SessionError);
      expect((err as SessionError).status).toBe(403);
      expect((err as SessionError).code).toBe('trial_expired');
    }
  });

  it('bloqueia suspended com código subscription_required', () => {
    try {
      assertOrgAccess({ status: 'suspended', trialEndsAt: null }, NOW);
      expect.unreachable('deveria lançar');
    } catch (err) {
      expect((err as SessionError).code).toBe('subscription_required');
    }
  });

  it('bloqueia pending (org criada mas nunca ativada)', () => {
    expect(() =>
      assertOrgAccess({ status: 'pending', trialEndsAt: null }, NOW),
    ).toThrow(SessionError);
  });
});

describe('sessionGuard', () => {
  it('converte SessionError em Response com shape de apiError', async () => {
    const res = sessionGuard(new SessionError(401, 'unauthorized', 'Faça login.'));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe('unauthorized');
    expect(body.message).toMatch(/login/i);
  });

  it('repassa erros que não são SessionError', () => {
    expect(() => sessionGuard(new Error('boom'))).toThrow('boom');
  });
});
