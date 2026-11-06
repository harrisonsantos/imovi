'use client';

import { useState } from 'react';
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  async function resendVerification() {
    if (!email) {
      setError('Informe seu e-mail primeiro.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, callbackURL: '/auditoria/login?verified=1' }),
      });
      if (!res.ok) setError('Não foi possível reenviar. Tente novamente em instantes.');
      else setNotice('Se a conta precisar de confirmação, enviaremos um novo link.');
    } catch {
      setError('Falha de rede. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? 'E-mail ou senha inválidos.');
        return;
      }
      const orgRes = await fetch('/api/auth/organization/list');
      if (!orgRes.ok) {
        setError('Não foi possível carregar suas imobiliárias. Tente novamente.');
        return;
      }
      const orgs = (await orgRes.json()) as Array<{ id: string }>;
      if (!orgs.length) {
        router.push('/auditoria/cadastro');
        return;
      }
      const active = await fetch('/api/auth/organization/set-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgs[0]!.id }),
      });
      if (!active.ok) {
        setError('Não foi possível selecionar sua imobiliária.');
        return;
      }
      router.push('/auditoria');
    } catch {
      setError('Falha de rede. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

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
      <div style={{ width: '100%', maxWidth: 400 }}>
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
            Auditoria de vendas — acesse sua conta
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
            <label htmlFor="email" style={labelStyle}>
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="password" style={labelStyle}>
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          {notice && (
            <p role="status" style={{ color: C.accent }}>
              {notice}
            </p>
          )}
          <button type="button" disabled={loading} onClick={resendVerification}>
            Reenviar confirmação de e-mail
          </button>
          {error && <p style={{ color: C.negative, fontSize: '0.8125rem', margin: 0 }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
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
            {loading ? 'Entrando…' : 'Entrar'}
          </button>

          <p style={{ color: C.text2, fontSize: '0.8125rem', textAlign: 'center', margin: 0 }}>
            Não tem conta?{' '}
            <Link href="/auditoria/cadastro" style={{ color: C.accent, textDecoration: 'none' }}>
              Cadastre sua imobiliária
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
