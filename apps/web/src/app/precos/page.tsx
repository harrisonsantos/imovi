'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Nav }  from '@/components/Nav';
import { Logo } from '@/components/Logo';
import { tokens as C } from '@/lib/tokens';

const CHECK = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const DASH = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const PLANS = [
  {
    id: 'free', name: 'Gratuito', price: 0, badge: null, highlight: false,
    desc: 'Para proprietários e corretores que querem uma estimativa rápida.',
    cta: 'Começar agora', ctaHref: '/#estimar',
    features: ['Estimativas ilimitadas', 'Intervalo de confiança 90%', 'Mediana do bairro incluída', 'Comparáveis recentes (3)', '1 cidade', null, null, null] as (string|null)[],
  },
  {
    id: 'pro', name: 'Profissional', price: 49, badge: 'Em breve', highlight: true,
    desc: 'Para corretores e consultores imobiliários que precisam de dados precisos.',
    cta: 'Entrar na lista', ctaHref: '#waitlist',
    features: ['Estimativas ilimitadas', 'Intervalo de confiança 90%', 'Mediana do bairro incluída', 'Comparáveis recentes (20+)', '5 cidades', 'Relatório PDF exportável', 'API REST (1.000 req/mês)', 'Histórico de estimativas'] as string[],
  },
  {
    id: 'enterprise', name: 'Enterprise', price: null, badge: 'Contato', highlight: false,
    desc: 'Para imobiliárias, fundos e construtoras com volume e necessidades customizadas.',
    cta: 'Falar com a equipe', ctaHref: '#waitlist',
    features: ['Estimativas ilimitadas', 'Intervalo de confiança 90%', 'Mediana do bairro incluída', 'Comparáveis recentes (50+)', 'Todas as cidades disponíveis', 'Relatórios white-label', 'API REST sem limite', 'Integração CRM / SLA'] as string[],
  },
];

const AUDIT_MAILTO = (tier: string) =>
  `mailto:hrrsnp@gmail.com?subject=${encodeURIComponent(`Imovi Auditoria — ${tier}`)}`;

const AUDIT_PLANS = [
  {
    id: 'audit-essencial', name: 'Essencial', price: 149, highlight: false,
    desc: 'Para imobiliárias pequenas que querem visibilidade total da operação.',
    limite: 'Até 5 corretores',
    features: ['Integração Vista CRM', '6 detectores de anomalia (incl. desvio vs AVM)', 'Relatório diário por e-mail', 'Dashboard de auditoria', 'Matrículas dos imóveis'],
  },
  {
    id: 'audit-profissional', name: 'Profissional', price: 299, highlight: true,
    desc: 'Para imobiliárias em crescimento com equipes de vendas maiores.',
    limite: 'Até 15 corretores',
    features: ['Integração Vista CRM', '6 detectores de anomalia (incl. desvio vs AVM)', 'Relatório diário por e-mail', 'Dashboard de auditoria', 'Matrículas dos imóveis'],
  },
  {
    id: 'audit-escala', name: 'Escala', price: 499, highlight: false,
    desc: 'Para grandes operações e redes com múltiplas equipes de corretores.',
    limite: 'Corretores ilimitados',
    features: ['Integração Vista CRM', '6 detectores de anomalia (incl. desvio vs AVM)', 'Relatório diário por e-mail', 'Dashboard de auditoria', 'Matrículas dos imóveis'],
  },
];

const COMPARE_ROWS = [
  { feature: 'Estimativas',           free: 'Ilimitado', pro: 'Ilimitado', ent: 'Ilimitado' },
  { feature: 'Cidades',               free: '1 cidade',  pro: '5 cidades', ent: 'Todas'    },
  { feature: 'Comparáveis',           free: '3',         pro: '20+',       ent: '50+'      },
  { feature: 'Intervalo de confiança',free: true,        pro: true,        ent: true        },
  { feature: 'Relatório PDF',         free: false,       pro: true,        ent: true        },
  { feature: 'API REST',              free: false,       pro: '1.000 req/mês', ent: 'Sem limite' },
  { feature: 'Histórico',             free: false,       pro: true,        ent: true        },
  { feature: 'White-label',           free: false,       pro: false,       ent: true        },
  { feature: 'SLA / suporte dedicado',free: false,       pro: false,       ent: true        },
];

export const runtime = 'edge';

export default function PrecosPage() {
  const [email, setEmail] = useState('');
  const [sent,  setSent]  = useState(false);

  return (
    <div style={{ background: C.bg, minHeight: '100vh', paddingBottom: '5rem' }}>
      <Nav />

      {/* Hero */}
      <section style={{ padding: 'clamp(6rem,12vh,9rem) clamp(1rem,4vw,2.5rem) clamp(3.5rem,6vh,5rem)', textAlign: 'center', position: 'relative', overflow: 'hidden', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '800px', height: '500px', background: `radial-gradient(ellipse,${C.accentGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', animation: 'fadeInUp 0.65s ease both' }}>
          <p style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent, marginBottom: '1rem' }}>Planos</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(2.25rem,5vw,3.75rem)', letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: '1.25rem' }}>
            Simples, transparente<br /><span style={{ color: C.accent }}>e gratuito para sempre</span>
          </h1>
          <p style={{ fontSize: 'clamp(0.9375rem,1.5vw,1.0625rem)', color: C.text2, lineHeight: 1.7, maxWidth: '520px', margin: '0 auto' }}>
            Estimativas básicas são e serão sempre gratuitas. Planos profissionais com API e relatórios chegam em breve.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section style={{ padding: 'clamp(3.5rem,7vh,5rem) clamp(1rem,4vw,2.5rem)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
            {PLANS.map(p => (
              <div key={p.id} style={{ background: C.surface, border: `1px solid ${p.highlight ? C.accentMid : C.border}`, borderRadius: '18px', padding: '1.75rem', position: 'relative', overflow: 'hidden', transition: 'border-color 0.2s', boxShadow: p.highlight ? `0 0 40px ${C.accentGlow}` : 'none' }}
                onMouseEnter={e => { if (!p.highlight) (e.currentTarget as HTMLElement).style.borderColor = C.borderMid; }}
                onMouseLeave={e => { if (!p.highlight) (e.currentTarget as HTMLElement).style.borderColor = C.border; }}>
                {p.highlight && <div style={{ position: 'absolute', top: 0, right: 0, width: '250px', height: '250px', background: `radial-gradient(ellipse at top right,${C.accentGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />}
                {p.badge
                  ? <div style={{ display: 'inline-flex', marginBottom: '1rem', padding: '3px 10px', borderRadius: '100px', background: p.highlight ? C.accentMid : C.blueDim, border: `1px solid ${p.highlight ? C.accentMid : 'rgba(79,142,247,0.25)'}`, color: p.highlight ? C.accent : C.blue, fontSize: '0.625rem', fontFamily: 'var(--font-mono)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{p.badge}</div>
                  : <div style={{ height: '27px', marginBottom: '1rem' }} />
                }
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.125rem', marginBottom: '0.5rem' }}>{p.name}</h2>
                <p style={{ fontSize: '0.8125rem', color: C.text2, lineHeight: 1.6, marginBottom: '1.5rem', minHeight: '48px' }}>{p.desc}</p>
                <div style={{ marginBottom: '1.75rem' }}>
                  {p.price === 0    && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.25rem', fontWeight: 500, letterSpacing: '-0.03em', color: C.text }}>Grátis<span style={{ fontSize: '1rem', color: C.text2 }}> / sempre</span></div>}
                  {typeof p.price === 'number' && p.price > 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.25rem', fontWeight: 500, letterSpacing: '-0.03em', color: C.text }}>R$&nbsp;{p.price}<span style={{ fontSize: '1rem', color: C.text2 }}>/mês</span></div>}
                  {p.price === null && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.25rem', fontWeight: 500, letterSpacing: '-0.03em', color: C.text }}>Custom</div>}
                </div>
                <Link href={p.ctaHref} style={{ display: 'block', width: '100%', padding: '0.8125rem', background: p.highlight ? C.accent : C.accentDim, border: `1px solid ${p.highlight ? C.accent : C.accentMid}`, color: p.highlight ? '#000' : C.accent, textDecoration: 'none', textAlign: 'center', fontSize: '0.9375rem', fontWeight: 700, borderRadius: '9px', transition: 'all 0.15s', marginBottom: '1.75rem' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; if (!p.highlight) (e.currentTarget as HTMLElement).style.background = C.accentMid; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; if (!p.highlight) (e.currentTarget as HTMLElement).style.background = C.accentDim; }}>
                  {p.cta}
                </Link>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {p.features.map((f, i) => f
                    ? <div key={i} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start' }}><span style={{ color: C.accent, flexShrink: 0, marginTop: '1px' }}>{CHECK}</span><span style={{ fontSize: '0.875rem', color: C.text2, lineHeight: 1.5 }}>{f}</span></div>
                    : <div key={i} style={{ height: '1px', background: C.border, margin: '4px 0' }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Auditoria para imobiliárias */}
      <section style={{ padding: '0 clamp(1rem,4vw,2.5rem) clamp(3.5rem,7vh,5rem)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <p style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent, marginBottom: '0.75rem' }}>Auditoria</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.5rem,3vw,2rem)', letterSpacing: '-0.03em', marginBottom: '0.75rem' }}>Auditoria para imobiliárias</h2>
            <p style={{ fontSize: '0.9375rem', color: C.text2, lineHeight: 1.7, maxWidth: '560px', margin: '0 auto' }}>
              Conecte seu Vista CRM e detecte anomalias na operação automaticamente — desvios de preço vs AVM, vendas não registradas e mais.
            </p>
          </div>
          <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
            {AUDIT_PLANS.map(p => (
              <div key={p.id} style={{ background: C.surface, border: `1px solid ${p.highlight ? C.accentMid : C.border}`, borderRadius: '18px', padding: '1.75rem', position: 'relative', overflow: 'hidden', transition: 'border-color 0.2s', boxShadow: p.highlight ? `0 0 40px ${C.accentGlow}` : 'none' }}
                onMouseEnter={e => { if (!p.highlight) (e.currentTarget as HTMLElement).style.borderColor = C.borderMid; }}
                onMouseLeave={e => { if (!p.highlight) (e.currentTarget as HTMLElement).style.borderColor = C.border; }}>
                {p.highlight && <div style={{ position: 'absolute', top: 0, right: 0, width: '250px', height: '250px', background: `radial-gradient(ellipse at top right,${C.accentGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />}
                <div style={{ display: 'inline-flex', marginBottom: '1rem', padding: '3px 10px', borderRadius: '100px', background: p.highlight ? C.accentMid : C.blueDim, border: `1px solid ${p.highlight ? C.accentMid : 'rgba(79,142,247,0.25)'}`, color: p.highlight ? C.accent : C.blue, fontSize: '0.625rem', fontFamily: 'var(--font-mono)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>14 dias grátis</div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.125rem', marginBottom: '0.5rem' }}>{p.name}</h2>
                <p style={{ fontSize: '0.8125rem', color: C.text2, lineHeight: 1.6, marginBottom: '1.5rem', minHeight: '48px' }}>{p.desc}</p>
                <div style={{ marginBottom: '1.75rem' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.25rem', fontWeight: 500, letterSpacing: '-0.03em', color: C.text }}>R$&nbsp;{p.price}<span style={{ fontSize: '1rem', color: C.text2 }}>/mês</span></div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: C.accent, marginTop: '0.375rem' }}>{p.limite}</div>
                </div>
                <a href={AUDIT_MAILTO(p.name)} style={{ display: 'block', width: '100%', padding: '0.8125rem', background: p.highlight ? C.accent : C.accentDim, border: `1px solid ${p.highlight ? C.accent : C.accentMid}`, color: p.highlight ? '#000' : C.accent, textDecoration: 'none', textAlign: 'center', fontSize: '0.9375rem', fontWeight: 700, borderRadius: '9px', transition: 'all 0.15s', marginBottom: '1.75rem' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; if (!p.highlight) (e.currentTarget as HTMLElement).style.background = C.accentMid; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; if (!p.highlight) (e.currentTarget as HTMLElement).style.background = C.accentDim; }}>
                  Falar com vendas
                </a>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {p.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start' }}><span style={{ color: C.accent, flexShrink: 0, marginTop: '1px' }}>{CHECK}</span><span style={{ fontSize: '0.875rem', color: C.text2, lineHeight: 1.5 }}>{f}</span></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compare table */}
      <section style={{ padding: '0 clamp(1rem,4vw,2.5rem) clamp(3.5rem,7vh,5rem)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.02em', marginBottom: '1.5rem', textAlign: 'center' }}>Comparação detalhada</h3>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '0.75rem 1.25rem', background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
              {['Feature','Gratuito','Profissional','Enterprise'].map((h, i) => <span key={h} style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: i === 2 ? C.accent : C.text2, textAlign: i > 0 ? 'center' : 'left' }}>{h}</span>)}
            </div>
            {COMPARE_ROWS.map((row, i) => (
              <div key={row.feature} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '0.875rem 1.25rem', borderBottom: i < COMPARE_ROWS.length - 1 ? `1px solid ${C.border}` : 'none', transition: 'background 0.15s', alignItems: 'center' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.surface2; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <span style={{ fontSize: '0.875rem', color: C.text }}>{row.feature}</span>
                {([row.free, row.pro, row.ent] as (boolean|string)[]).map((val, j) => (
                  <div key={j} style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {val === true  && <span style={{ color: C.accent }}>{CHECK}</span>}
                    {val === false && <span style={{ color: C.text3 }}>{DASH}</span>}
                    {typeof val === 'string' && <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: j === 1 ? C.accent : C.text2 }}>{val}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" style={{ padding: '0 clamp(1rem,4vw,2.5rem) clamp(3rem,5vh,4rem)' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '18px', padding: '2.5rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '400px', height: '300px', background: `radial-gradient(ellipse,${C.accentGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '4px 13px', borderRadius: '100px', border: `1px solid ${C.accentMid}`, background: C.accentDim, marginBottom: '1.25rem' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent }} />
              <span style={{ fontSize: '0.6875rem', color: C.accent, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>Plano Pro em desenvolvimento</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.03em', marginBottom: '0.75rem' }}>Entre na lista de espera</h2>
            <p style={{ color: C.text2, fontSize: '0.9rem', lineHeight: 1.65, marginBottom: '1.75rem' }}>Acesso antecipado e desconto de fundadores.</p>
            {!sent ? (
              <form onSubmit={e => { e.preventDefault(); if (email) setSent(true); }} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input type="email" required placeholder="seu@email.com.br" value={email} onChange={e => setEmail(e.target.value)}
                  style={{ flex: 1, minWidth: '200px', padding: '0.75rem 1rem', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, fontSize: '0.9375rem', fontFamily: 'var(--font-body)', transition: 'border-color 0.15s' }}
                  onFocus={e => { (e.target as HTMLElement).style.borderColor = C.accentMid; }}
                  onBlur={e  => { (e.target as HTMLElement).style.borderColor = C.border; }} />
                <button type="submit" style={{ padding: '0.75rem 1.5rem', background: C.accent, color: '#000', border: 'none', borderRadius: '8px', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
                  Entrar na lista →
                </button>
              </form>
            ) : (
              <div style={{ padding: '1rem', background: C.accentDim, border: `1px solid ${C.accentMid}`, borderRadius: '9px', display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: C.accent }}>{CHECK}</span>
                <span style={{ color: C.accent, fontSize: '0.9375rem', fontWeight: 600 }}>Você está na lista!</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div style={{ borderTop: `1px solid ${C.border}`, padding: '1.5rem clamp(1rem,4vw,2.5rem)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <Logo size={20} />
        <p style={{ fontSize: '0.8125rem', color: C.text3 }}>© {new Date().getFullYear()} imovi. Cancelamento a qualquer momento.</p>
        <Link href="/" style={{ fontSize: '0.8125rem', color: C.text2, textDecoration: 'none' }}>← Voltar ao início</Link>
      </div>
    </div>
  );
}
