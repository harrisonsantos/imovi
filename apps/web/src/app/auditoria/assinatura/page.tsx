'use client';

/**
 * Paywall do módulo de auditoria — exibida quando o trial terminou ou a
 * assinatura está inativa (fetchAuditoria redireciona 403 trial_expired /
 * subscription_required para cá).
 *
 * Página standalone: não depende de métricas nem de edições no layout —
 * renderiza sozinha dentro do shell de /auditoria.
 */

import Link from 'next/link';
import { tokens as C } from '@/lib/tokens';

const MAILTO = (tier: string) =>
  `mailto:hrrsnp@gmail.com?subject=${encodeURIComponent(`Imovi Auditoria — ${tier}`)}`;

const TIERS = [
  { name: 'Essencial', price: 149, limite: 'Até 5 corretores', highlight: false },
  { name: 'Profissional', price: 299, limite: 'Até 15 corretores', highlight: true },
  { name: 'Escala', price: 499, limite: 'Corretores ilimitados', highlight: false },
];

const FEATURES = [
  'Integração Vista CRM',
  '6 detectores de anomalia (incl. desvio vs AVM)',
  'Relatório diário por e-mail',
  'Dashboard de auditoria',
  'Matrículas dos imóveis',
];

const CHECK = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function AssinaturaPage() {
  return (
    <div style={{ padding: '2.5rem 1.75rem', maxWidth: '880px', margin: '0 auto' }}>
      {/* Cabeçalho do paywall */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <p style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent, marginBottom: '0.75rem' }}>
          Assinatura
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.5rem,3vw,2rem)', letterSpacing: '-0.03em', color: C.text, marginBottom: '0.75rem' }}>
          Seu período de avaliação terminou
        </h1>
        <p style={{ fontSize: '0.9375rem', color: C.text2, lineHeight: 1.7, maxWidth: '520px', margin: '0 auto' }}>
          Para continuar usando o dashboard de auditoria, ative uma assinatura.
          Seus dados continuam sendo recebidos e ficam guardados — nada se perde
          ao assinar.
        </p>
      </div>

      {/* Tiers compactos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        {TIERS.map((t) => (
          <div
            key={t.name}
            style={{
              background: C.surface,
              border: `1px solid ${t.highlight ? C.accentMid : C.border}`,
              borderRadius: '14px',
              padding: '1.25rem',
              boxShadow: t.highlight ? `0 0 30px ${C.accentGlow}` : 'none',
            }}
          >
            <div style={{ display: 'inline-flex', marginBottom: '0.75rem', padding: '2px 9px', borderRadius: '100px', background: C.accentDim, border: `1px solid ${C.accentMid}`, color: C.accent, fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              14 dias grátis
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: C.text, marginBottom: '0.375rem' }}>{t.name}</h2>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 500, letterSpacing: '-0.03em', color: C.text }}>
              R$&nbsp;{t.price}
              <span style={{ fontSize: '0.8125rem', color: C.text2 }}>/mês</span>
            </div>
            <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: C.accent, marginTop: '0.25rem', marginBottom: '0.875rem' }}>{t.limite}</div>
            <a
              href={MAILTO(t.name)}
              style={{ display: 'block', padding: '0.625rem', background: t.highlight ? C.accent : C.accentDim, border: `1px solid ${t.highlight ? C.accent : C.accentMid}`, color: t.highlight ? '#000' : C.accent, textDecoration: 'none', textAlign: 'center', fontSize: '0.8125rem', fontWeight: 700, borderRadius: '8px' }}
            >
              Falar com vendas
            </a>
          </div>
        ))}
      </div>

      {/* Features comuns aos planos */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '1.25rem 1.5rem', marginBottom: '2rem' }}>
        <p style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.12em', color: C.text2, marginBottom: '0.75rem' }}>
          Incluído em todos os planos
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
          {FEATURES.map((f) => (
            <div key={f} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ color: C.accent, flexShrink: 0, marginTop: '2px' }}>{CHECK}</span>
              <span style={{ fontSize: '0.8125rem', color: C.text2, lineHeight: 1.5 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <Link href="/" style={{ fontSize: '0.8125rem', color: C.text2, textDecoration: 'none' }}>
          ← Voltar ao site
        </Link>
      </div>
    </div>
  );
}
