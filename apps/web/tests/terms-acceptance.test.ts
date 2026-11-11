import './helpers/react-global';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: vi.fn(),
  db: vi.fn(),
  record: vi.fn(),
  hasAccepted: vi.fn(),
  requireSession: vi.fn(),
}));
vi.mock('@/lib/cf-env', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getCfEnv: mocks.env,
}));
vi.mock('@/lib/db', () => ({ getDb: mocks.db }));
vi.mock('@imovi/db/members', () => ({
  memberRepo: { findByUserAndOrg: vi.fn() },
  termsRepo: { record: mocks.record, hasAccepted: mocks.hasAccepted },
}));
vi.mock('@/lib/session', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireSession: mocks.requireSession,
}));

import { PRIVACY_VERSION, TERMS_VERSION, formatVersionDate } from '../src/lib/terms-version';
import { buildSignupBody, buildTermsAcceptanceBody } from '../src/lib/cadastro';
import {
  assertSignupTermsAccepted,
  recordSignupAcceptance,
  requireCurrentTermsAcceptance,
} from '../src/lib/terms';
import { POST as acceptTerms } from '../src/app/api/auditoria/termos/route';
import { SessionError } from '../src/lib/session';
import TermosPage from '../src/app/termos/page';
import PrivacidadePage from '../src/app/privacidade/page';
import CadastroPage from '../src/app/auditoria/cadastro/page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const accepted = {
  termsAccepted: true,
  termsVersion: TERMS_VERSION,
  privacyVersion: PRIVACY_VERSION,
};

function acceptRequest(body: unknown, origin = 'https://imovi.test') {
  return new Request('https://imovi.test/api/auditoria/termos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.mockResolvedValue({ NEXT_PUBLIC_APP_URL: 'https://imovi.test', DATABASE_URL: 'x' });
  mocks.db.mockReturnValue({ fake: 'db' });
  mocks.requireSession.mockResolvedValue({
    userId: 'u-1',
    email: 'ana@alfa.com',
    activeOrganizationId: null,
  });
  mocks.record.mockImplementation(async (_db: unknown, input: Record<string, unknown>) => ({
    id: 'acc-1',
    ...input,
    acceptedAt: new Date('2026-11-05T12:00:00Z'),
  }));
});

describe('versão vigente dos termos', () => {
  it('é a data de atualização exibida nas páginas de Termos e Privacidade', () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const termos = renderToStaticMarkup(createElement(TermosPage));
    const privacidade = renderToStaticMarkup(createElement(PrivacidadePage));
    expect(termos).toContain(`Última atualização: ${formatVersionDate(TERMS_VERSION)}`);
    expect(privacidade).toContain(`Última atualização: ${formatVersionDate(PRIVACY_VERSION)}`);
    expect(formatVersionDate('2026-07-10')).toBe('10 de julho de 2026');
  });
});

describe('payloads do cadastro', () => {
  it('o cadastro envia o aceite com as versões vigentes junto com a criação da conta', () => {
    expect(buildSignupBody({ name: 'Ana', email: 'ana@alfa.com', password: '12345678' })).toEqual({
      name: 'Ana',
      email: 'ana@alfa.com',
      password: '12345678',
      callbackURL: '/auditoria/login?verified=1',
      ...accepted,
    });
    expect(buildTermsAcceptanceBody()).toEqual(accepted);
  });

  it('a página de cadastro mostra o checkbox obrigatório e a versão aceita', () => {
    const page = renderToStaticMarkup(createElement(CadastroPage));
    expect(page).toMatch(/type="checkbox"[^>]*required/);
    expect(page).toContain(`versão de ${formatVersionDate(TERMS_VERSION)}`);
  });
});

describe('validação do aceite no cadastro (servidor)', () => {
  it('recusa cadastro sem aceite ou com versão desatualizada', () => {
    for (const body of [
      {},
      { ...accepted, termsAccepted: false },
      { ...accepted, termsVersion: '2020-01-01' },
      { ...accepted, privacyVersion: undefined },
      null,
    ]) {
      expect(() => assertSignupTermsAccepted(body)).toThrow(/Termos de uso/);
    }
    expect(() => assertSignupTermsAccepted({ name: 'Ana', ...accepted })).not.toThrow();
  });

  it('grava o aceite do novo usuário com origem signup', async () => {
    await recordSignupAcceptance({ fake: 'db' } as never, 'u-9');
    expect(mocks.record).toHaveBeenCalledWith(
      { fake: 'db' },
      {
        userId: 'u-9',
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        source: 'signup',
      },
    );
  });

  it('bloqueia a criação da imobiliária sem aceite da versão vigente', async () => {
    mocks.hasAccepted.mockResolvedValueOnce(false);
    await expect(requireCurrentTermsAcceptance({} as never, 'u-1')).rejects.toThrow(
      /Termos de uso/,
    );
    mocks.hasAccepted.mockResolvedValueOnce(true);
    await expect(requireCurrentTermsAcceptance({} as never, 'u-1')).resolves.toBeUndefined();
    expect(mocks.hasAccepted).toHaveBeenLastCalledWith({}, 'u-1', TERMS_VERSION);
  });
});

describe('POST /api/auditoria/termos', () => {
  it('persiste versão e data/hora do aceite para o usuário da sessão', async () => {
    const res = await acceptTerms(acceptRequest(accepted));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      accepted: true,
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
      acceptedAt: '2026-11-05T12:00:00.000Z',
    });
    expect(mocks.record).toHaveBeenCalledWith(
      { fake: 'db' },
      {
        userId: 'u-1',
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        source: 'auditoria_cadastro',
      },
    );
  });

  it('recusa versão desatualizada, ausência de aceite e origem externa', async () => {
    expect((await acceptTerms(acceptRequest({ ...accepted, termsVersion: 'velha' }))).status).toBe(
      400,
    );
    expect((await acceptTerms(acceptRequest({ termsAccepted: false }))).status).toBe(400);
    expect((await acceptTerms(acceptRequest(accepted, 'https://evil.test'))).status).toBe(403);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it('exige sessão', async () => {
    mocks.requireSession.mockRejectedValueOnce(new SessionError(401, 'unauthenticated', 'x'));
    expect((await acceptTerms(acceptRequest(accepted))).status).toBe(401);
    expect(mocks.record).not.toHaveBeenCalled();
  });
});

describe('Política de privacidade cita o registro do aceite', () => {
  const page = renderToStaticMarkup(createElement(PrivacidadePage))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

  it('tem nova versão, exibida na página', () => {
    expect(PRIVACY_VERSION).toBe('2026-11-11');
    expect(page).toContain('Última atualização: 11 de novembro de 2026');
  });

  it('explica exclusão por anonimização e retenção do aceite', () => {
    expect(page).toMatch(/exclusão da conta.*anonimização dos dados cadastrais/);
    expect(page).toMatch(/apenas o registro de aceite.*prazo prescricional legal/);
  });

  it('descreve dados, finalidade, base legal, retenção e histórico por versão', () => {
    const section = page.slice(page.indexOf('Registro do aceite dos termos'));
    expect(page).toContain('Registro do aceite dos termos');
    for (const fact of [
      /identificador da sua conta/,
      /versão dos Termos de uso/,
      /versão desta Política/,
      /origem do aceite/,
      /data e hora/,
      /comprovar/,
      /execução de contrato/,
      /cumprimento de obrigação legal/,
      /art\. 7º, incisos V e II/,
      /enquanto a conta existir/,
      /prazo prescricional/,
      /cada versão aceita/,
    ]) {
      expect(section).toMatch(fact);
    }
  });
});
