'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { tokens as C } from '@/lib/tokens';

export const runtime = 'edge';

const AUDIT_PLANS = [
  { id: 'audit-essencial', name: 'Essencial', price: 149, limit: 'Até 5 corretores' },
  { id: 'audit-profissional', name: 'Profissional', price: 299, limit: 'Até 15 corretores' },
  { id: 'audit-escala', name: 'Escala', price: 499, limit: 'Corretores ilimitados' },
];

export default function PrecosPage() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent }),
      });
      const body = (await response.json()) as { registered?: boolean; message?: string };
      if (!response.ok || !body.registered)
        throw new Error(body.message ?? 'Não foi possível salvar seu contato.');
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha de rede. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  const card = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: '16px',
    padding: '1.75rem',
  };
  return (
    <>
      <Nav />
      <main
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '7rem 1.5rem 4rem',
          lineHeight: 1.7,
        }}
      >
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Planos e disponibilidade</h1>
        <section style={card}>
          <h2>Estimativa básica gratuita</h2>
          <p>
            Referência heurística por área e bairro, com faixa indicativa, origem dos dados e
            resultado salvo.
          </p>
          <p>
            O limite padrão de proteção é de dez tentativas por minuto. Cidades e bairros
            disponíveis aparecem no formulário. A faixa não tem confiança estatística validada.
          </p>
          <Link href="/#estimar" style={{ color: C.accent }}>
            Estimar agora →
          </Link>
        </section>
        <section style={{ marginTop: '3rem' }}>
          <h2>Auditoria para imobiliárias</h2>
          <p>
            Planos da Auditoria. A configuração de integração, a cobertura dos dados e a ativação da
            assinatura são confirmadas durante o cadastro.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
              gap: '1rem',
              marginTop: '1rem',
            }}
          >
            {AUDIT_PLANS.map((plan) => (
              <article key={plan.id} style={card}>
                <h3>{plan.name}</h3>
                <p style={{ fontSize: '1.75rem' }}>R$ {plan.price}/mês</p>
                <p>{plan.limit}</p>
                <p>Dashboard e análise de anomalias da operação.</p>
                <Link
                  href={`/auditoria/cadastro?plan=${encodeURIComponent(plan.id)}`}
                  style={{ color: C.accent }}
                >
                  Conhecer o plano →
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section id="waitlist" style={{ ...card, marginTop: '3rem' }}>
          <h2>Novidades sobre estimativas profissionais</h2>
          <p>
            Recursos como relatórios exportáveis e integrações estão em estudo. A inscrição não é
            compra nem garante recursos, preço ou data de lançamento.
          </p>
          {sent ? (
            <p role="status" style={{ color: C.accent }}>
              Seu contato foi salvo na lista de espera.
            </p>
          ) : (
            <form onSubmit={register} style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
              <label>
                E-mail{' '}
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu@email.com.br"
                  style={{
                    padding: '0.75rem',
                    background: C.surface2,
                    color: C.text,
                    border: `1px solid ${C.border}`,
                    borderRadius: '8px',
                    width: '100%',
                  }}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />{' '}
                Aceito armazenar meu e-mail e receber novidades sobre estimativas profissionais.
                Posso solicitar a remoção pelo contato no rodapé.
              </label>
              {error && (
                <p role="alert" style={{ color: C.negative }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting || !consent}
                style={{
                  padding: '0.75rem',
                  background: C.accent,
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                {submitting ? 'Salvando…' : 'Entrar na lista'}
              </button>
            </form>
          )}
        </section>
        <Link href="/" style={{ display: 'inline-block', marginTop: '2rem', color: C.accent }}>
          ← Voltar ao início
        </Link>
      </main>
      <Footer />
    </>
  );
}
