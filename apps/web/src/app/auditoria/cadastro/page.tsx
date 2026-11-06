'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

export default function CadastroPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [existingAccount, setExistingAccount] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  useEffect(() => {
    setOrgName(sessionStorage.getItem('imovi:org-draft') ?? '');
    void fetch('/api/auth/get-session')
      .then((res) => res.json())
      .then((raw: unknown) => {
        const data = raw as { user?: { emailVerified?: boolean } } | null;
        if (data?.user) setExistingAccount(true);
      })
      .catch(() => undefined)
      .finally(() => setCheckingSession(false));
  }, []);
  const [orgName, setOrgName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!existingAccount && password.length < 8) {
      setError('A senha precisa de pelo menos 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      sessionStorage.setItem('imovi:org-draft', orgName);
      if (!existingAccount) {
        // Confirmação de e-mail antecede o provisionamento da imobiliária.
        const signup = await fetch('/api/auth/sign-up/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            password,
            callbackURL: '/auditoria/login?verified=1',
          }),
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

      // 2. Cria a organização (imobiliária) — trial de 14 dias automático
      const orgRes = await fetch('/api/auth/organization/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgName,
          slug: `${slugify(orgName)}-${Math.random().toString(36).slice(2, 7)}`,
        }),
      });
      if (!orgRes.ok) {
        setError(
          'Conta criada, mas falhou ao registrar a imobiliária. Faça login e tente de novo.',
        );
        return;
      }

      // 3. Define a org como ativa na sessão
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

      sessionStorage.removeItem('imovi:org-draft');
      router.push('/auditoria');
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
          imobiliária.
        </p>
        <Link href="/auditoria/login">Entrar ou reenviar confirmação</Link>
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
            Cadastre sua imobiliária — 14 dias grátis de auditoria de vendas
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
            <input type="checkbox" required style={{ marginTop: '0.2rem' }} />
            <span>
              Li e aceito os{' '}
              <Link href="/termos" target="_blank" style={{ color: C.accent }}>
                Termos de uso
              </Link>{' '}
              e a{' '}
              <Link href="/privacidade" target="_blank" style={{ color: C.accent }}>
                Política de privacidade
              </Link>
              .
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
                  ? 'Concluir cadastro da imobiliária'
                  : 'Confirmar e-mail e começar'}
          </button>

          <p style={{ color: C.text2, fontSize: '0.8125rem', textAlign: 'center', margin: 0 }}>
            Já tem conta?{' '}
            <Link href="/auditoria/login" style={{ color: C.accent, textDecoration: 'none' }}>
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
