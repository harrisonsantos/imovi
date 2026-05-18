'use client';

import { tokens as C } from '@/lib/tokens';

const steps = [
  {
    n: '01',
    title: 'Informe os dados',
    desc:  'Selecione bairro, área em m², tipo de imóvel e características como quartos e vagas.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="5" width="18" height="14" rx="2"/>
        <line x1="7" y1="9" x2="17" y2="9"/>
        <line x1="7" y1="13" x2="13" y2="13"/>
      </svg>
    ),
  },
  {
    n: '02',
    title: 'Modelo calcula',
    desc:  'Cruzamos anúncios de mercado, índices por bairro e dados geoespaciais para gerar uma estimativa calibrada com comparáveis reais.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      </svg>
    ),
  },
  {
    n: '03',
    title: 'Receba a estimativa',
    desc:  'Valor central com intervalo de confiança. Comparáveis por bairro, histórico de preços e dados atualizados diariamente.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      style={{
        padding:       'clamp(4rem,8vh,5.5rem) clamp(1rem,4vw,2.5rem)',
        background:    C.surface,
        borderTop:     `1px solid ${C.border}`,
        borderBottom:  `1px solid ${C.border}`,
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <p style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent, marginBottom: '0.75rem' }}>
          Como funciona
        </p>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.75rem,3vw,2.375rem)', letterSpacing: '-0.03em', marginBottom: '2.5rem' }}>
          Três etapas, resultado imediato
        </h2>
        <div className="how-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1.25rem' }}>
          {steps.map((s) => (
            <div
              key={s.n}
              style={{ padding: '1.75rem', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '14px', position: 'relative', overflow: 'hidden', transition: 'border-color 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.borderMid; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
            >
              <div style={{ position: 'absolute', top: '-0.625rem', right: '0.875rem', fontFamily: 'var(--font-mono)', fontSize: '4.5rem', fontWeight: 500, color: C.border, lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>
                {s.n}
              </div>
              <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: C.accentDim, border: `1px solid ${C.accentMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent, marginBottom: '1.125rem', position: 'relative', flexShrink: 0 }}>
                {s.icon}
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.0625rem', marginBottom: '0.625rem', position: 'relative' }}>
                {s.title}
              </h3>
              <p style={{ fontSize: '0.875rem', color: C.text2, lineHeight: 1.65, position: 'relative' }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
