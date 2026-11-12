'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { buildSignupBody, buildTermsAcceptanceBody, TERMS_ACCEPT_ENDPOINT } from '@/lib/cadastro';
import { formatVersionDate, PRIVACY_VERSION, TERMS_VERSION } from '@/lib/terms-version';
import type { BillingProduct } from '@/lib/billing';
import { tokens as C } from '@/lib/tokens';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6875rem 0.875rem',
  background: C.surface3,
  border: `1px solid ${C.border}`,
  borderRadius: '8px',
  color: C.text,
  fontSize: '0.875rem',
  fontFamily: 'var(--font-body)',
  transition: 'border-color 0.15s',
};
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: C.text2,
  marginBottom: '0.3125rem',
};

/** Slug simples a partir do nome da imobiliária (better-auth exige slug único). */
function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function CadastroForm({ product = 'audit' }: { product?: BillingProduct }) {
  const pro = product === 'corretor_pro';
  const loginPath = pro ? '/conta/login' : '/auditoria/login';
  const draftKey = pro ? 'imovi:pro-draft' : 'imovi:org-draft';
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [existingAccount, setExistingAccount] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  useEffect(() => {
    setOrgName(sessionStorage.getItem(draftKey) ?? '');
    void fetch('/api/auth/get-session')
      .then((res) => res.json())
      .then((raw: unknown) => {
        const data = raw as { user?: { emailVerified?: boolean } } | null;
        if (data?.user) setExistingAccount(true);
      })
      .catch(() => undefined)
      .finally(() => setCheckingSession(false));
  }, [draftKey]);
  const [orgName, setOrgName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!termsAccepted) {
      setError('Aceite os Termos de uso e a Política de privacidade para continuar.');
      return;
    }
    if (!existingAccount && password.length < 8) {
      setError('A senha precisa de pelo menos 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      sessionStorage.setItem(draftKey, orgName);
      if (!existingAccount) {
        // Confirmação de e-mail antecede o provisionamento da imobiliária.
        const signup = await fetch('/api/auth/sign-up/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // O servidor recusa o cadastro sem aceite da versão vigente.
          body: JSON.stringify(buildSignupBody({ name, email, password }, product)),
        });
        if (!signup.ok) {
          const body = (await signup.json().catch(() => null)) as { message?: string } | null;
          setError(body?.message ?? 'Não foi possível criar a conta.');
          return;
        }

        const sessionResponse = await fetch('/api/auth/get-session');
        const session = (await sessionResponse.json()) as { user?: unknown } | null;
        if (!session?.user) {
          setConfirmation(true);
          return;
        }
      }

      // 2. Registra o aceite (versão + data/hora) para o usuário da sessão;
      // sem ele o servidor não cria a imobiliária.
      const termsRes = await fetch(pro ? '/api/conta/termos' : TERMS_ACCEPT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildTermsAcceptanceBody()),
      });
      if (!termsRes.ok) {
        const body = (await termsRes.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? 'Não foi possível registrar o aceite dos termos.');
        return;
      }

      // 3. Cria a organização (imobiliária) — trial de 14 dias automático
      const orgRes = await fetch('/api/auth/organization/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pro ? 'Conta Corretor Pro' : orgName,
          slug: `${slugify(pro ? 'corretor-pro' : orgName)}-${crypto.randomUUID()}`,
          ...(pro ? { metadata: { product: 'corretor_pro' } } : {}),
        }),
      });
      if (!orgRes.ok) {
        setError(
          'Conta criada, mas falhou ao registrar a imobiliária. Faça login e tente de novo.',
        );
        return;
      }

      // 4. Define a org como ativa na sessão
      const org = (await orgRes.json()) as { id?: string };
      if (org.id) {
        const active = await fetch('/api/auth/organization/set-active', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: org.id }),
        });
        if (!active.ok) {
          setError('Imobiliária criada. Faça login novamente para selecionar sua conta.');
          return;
        }
      }

      sessionStorage.removeItem(draftKey);
      router.push(pro ? '/conta/estimativas' : '/auditoria');
    } catch {
      setError('Falha de rede. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (confirmation)
    return (
      <main style={{ padding: '3rem', background: C.bg, color: C.text, minHeight: '100vh' }}>
        <h1>Confirme seu e-mail</h1>
        <p>
          Enviamos um link para {email}. Depois de confirmar, entre para concluir o cadastro da
          conta.
        </p>
        <Link href={loginPath}>Entrar ou reenviar confirmação</Link>
      </main>
    );

  return (
    <main
      style={{
        minHeight: '100vh',
        background: C.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link
            href="/"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '1.5rem',
              color: C.text,
              textDecoration: 'none',
            }}
          >
            imovi<span style={{ color: C.accent }}>.</span>
          </Link>
          <p style={{ color: C.text2, fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {pro
              ? 'Crie sua conta individual Corretor Pro'
              : 'Cadastre sua imobiliária — 14 dias grátis de auditoria de vendas'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {!pro && (
            <div>
              <label htmlFor="orgName" style={labelStyle}>
                Nome da imobiliária
              </label>
              <input
                id="orgName"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                style={inputStyle}
                placeholder="Ex: Imobiliária Horizonte"
              />
            </div>
          )}
          <div hidden={existingAccount}>
            <label htmlFor="name" style={labelStyle}>
              Seu nome
            </label>
            <input
              id="name"
              required={!existingAccount}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div hidden={existingAccount}>
            <label htmlFor="email" style={labelStyle}>
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required={!existingAccount}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div hidden={existingAccount}>
            <label htmlFor="password" style={labelStyle}>
              Senha (mín. 8 caracteres)
            </label>
            <input
              id="password"
              type="password"
              required={!existingAccount}
              minLength={existingAccount ? undefined : 8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          <label
            style={{
              display: 'flex',
              gap: '0.625rem',
              alignItems: 'flex-start',
              color: C.text2,
              fontSize: '0.75rem',
              lineHeight: 1.5,
            }}
          >
            <input
              type="checkbox"
              required
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              style={{ marginTop: '0.2rem' }}
            />
            <span>
              Li e aceito os{' '}
              <Link href="/termos" target="_blank" style={{ color: C.accent }}>
                Termos de uso
              </Link>{' '}
              e a{' '}
              <Link href="/privacidade" target="_blank" style={{ color: C.accent }}>
                Política de privacidade
              </Link>{' '}
              (versão de {formatVersionDate(TERMS_VERSION)} e de{' '}
              {formatVersionDate(PRIVACY_VERSION)}). A data e a versão do aceite ficam registradas.
            </span>
          </label>

          {error && <p style={{ color: C.negative, fontSize: '0.8125rem', margin: 0 }}>{error}</p>}

          <button
            type="submit"
            disabled={loading || checkingSession}
            style={{
              padding: '0.75rem',
              background: C.accent,
              color: '#04110a',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: '0.875rem',
              fontFamily: 'var(--font-body)',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {checkingSession
              ? 'Carregando…'
              : loading
                ? 'Criando conta…'
                : existingAccount
                  ? pro
                    ? 'Continuar para assinatura'
                    : 'Concluir cadastro da imobiliária'
                  : 'Confirmar e-mail e começar'}
          </button>

          <p style={{ color: C.text2, fontSize: '0.8125rem', textAlign: 'center', margin: 0 }}>
            Já tem conta?{' '}
            <Link href={loginPath} style={{ color: C.accent, textDecoration: 'none' }}>
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
