'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { BILLING_PLANS } from '@/lib/billing';
import { tokens as C } from '@/lib/tokens';

export const runtime = 'edge';

/** Preço e limite vêm de BILLING_PLANS, a mesma fonte do checkout e do webhook. */
function corretoresLabel(max: number | null, previous: number | null): string {
  if (max !== null) return `Até ${max} corretores`;
  return previous !== null
    ? `Acima de ${previous} corretores`
    : 'Sem limite de corretores no plano';
}
const AUDIT_PLANS = BILLING_PLANS.map((plan, i) => ({
  id: plan.id,
  name: plan.name,
  price: plan.priceMonthly,
  limit: corretoresLabel(plan.maxCorretores, BILLING_PLANS[i - 1]?.maxCorretores ?? null),
}));

/** Entregue hoje em todos os planos da Auditoria. */
const AUDIT_FEATURES = [
  'Importação de imóveis, negócios, leads e corretores do Vista CRM',
  'Verificação diária de anomalias na operação',
  'Painel de negócios, leads e corretores',
  'Exportação em CSV das listas',
  'Teste grátis de 14 dias, sem cartão',
];

/** Ainda não entregue: não faz parte de nenhum plano pago. */
const COMING_SOON = [
  'Relatórios de avaliação em PDF',
  'Imóveis comparáveis e histórico de preços na estimativa',
  'Plano para corretores com mais estimativas e sem anúncios',
  'API de estimativas para integrações',
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
            Auditoria de vendas para imobiliárias que usam o Vista CRM. Todos os planos incluem:
          </p>
          <ul>
            {AUDIT_FEATURES.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <p style={{ color: C.text2 }}>
            Os planos diferem pelo número de corretores ativos. Se a operação passar do limite, os
            dados continuam sendo importados e você recebe um aviso para trocar de plano.
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
        <section id="em-breve" style={{ ...card, marginTop: '3rem' }}>
          <h2>Em breve</h2>
          <p>
            Estes recursos estão em desenvolvimento, sem data definida, e não fazem parte de nenhum
            plano pago:
          </p>
          <ul>
            {COMING_SOON.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <a href="#waitlist" style={{ color: C.accent }}>
            Avise-me quando lançar →
          </a>
        </section>
        <section id="waitlist" style={{ ...card, marginTop: '3rem' }}>
          <h2>Lista de espera</h2>
          <p>
            Receba um aviso quando os recursos acima forem lançados. A inscrição não é compra nem
            garante recursos, preço ou data de lançamento.
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
