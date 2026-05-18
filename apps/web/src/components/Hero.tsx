'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tokens as C } from '@/lib/tokens';

// ── Types ──────────────────────────────────────────────────────────────────
interface HoodData {
  name:   string;
  price:  number;
  change: number;
}

// ── Static hood data (replace with real /api/neighborhoods data) ───────────
const HOODS: HoodData[] = [
  { name: 'Batel',         price: 12400, change:  2.1 },
  { name: 'Bigorrilho',    price:  9800, change:  1.8 },
  { name: 'Jardim Social', price:  9200, change:  0.9 },
  { name: 'Cabral',        price:  8600, change:  1.2 },
  { name: 'Água Verde',    price:  8200, change: -0.3 },
  { name: 'Hugo Lange',    price:  7900, change:  0.7 },
  { name: 'Mercês',        price:  7600, change:  0.4 },
  { name: 'Alto da XV',    price:  7200, change:  1.5 },
];

const brlK = (n: number) =>
  `R\u00a0${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')}k`;

// ── Chart ──────────────────────────────────────────────────────────────────
function HeroChart() {
  const [anim, setAnim] = useState(false);
  const max = HOODS[0]!.price;

  useEffect(() => {
    const t = setTimeout(() => setAnim(true), 550);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: '16px', padding: '1.5rem 1.5rem 1.25rem', position: 'relative', overflow: 'hidden',
    }}>
      {[20, 43, 66].map(p => (
        <div key={p} style={{
          position: 'absolute', left: `${p}%`, top: 0, bottom: 0,
          borderLeft: `1px solid ${C.border}`, opacity: 0.4, pointerEvents: 'none',
        }} />
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', position: 'relative' }}>
        <div>
          <p style={{ fontSize: '0.5875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent, marginBottom: '3px' }}>
            CURITIBA / PR
          </p>
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.text }}>Mediana R$/m² por bairro</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, animation: 'pulse 2.5s ease infinite' }} />
          <span style={{ fontSize: '0.5875rem', color: C.text2, fontFamily: 'var(--font-mono)' }}>ao vivo</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
        {HOODS.map((h, i) => {
          const pct = (h.price / max) * 76;
          const isTop = i === 0;
          const opacity = Math.max(0.22, 0.75 - i * 0.06);
          return (
            <div key={h.name} style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <div style={{ width: '86px', fontSize: '0.6875rem', color: isTop ? C.text : C.text2, fontWeight: isTop ? 600 : 400, textAlign: 'right', flexShrink: 0 }}>
                {h.name}
              </div>
              <div style={{ flex: 1, height: '19px', background: C.surface2, borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: anim ? `${pct}%` : '0%',
                  background: isTop ? C.accent : `color-mix(in srgb,${C.accent} ${Math.round(opacity * 100)}%,transparent)`,
                  borderRadius: '3px',
                  transition: `width 0.55s cubic-bezier(0.4,0,0.2,1) ${i * 0.072}s`,
                }} />
              </div>
              <div style={{ width: '60px', fontSize: '0.625rem', fontFamily: 'var(--font-mono)', color: isTop ? C.accent : C.text2, flexShrink: 0 }}>
                {brlK(h.price)}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ marginTop: '1rem', fontSize: '0.5625rem', color: C.text3, fontFamily: 'var(--font-mono)', position: 'relative' }}>
        Zap · OLX · VivaReal — dados agregados
      </p>
    </div>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────
export function Hero() {
  return (
    <section style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      padding: 'clamp(5rem,11vh,8rem) clamp(1rem,4vw,2.5rem) clamp(3rem,6vh,5rem)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Glow */}
      <div style={{ position: 'absolute', top: '15%', left: '-8%', width: '680px', height: '680px', background: `radial-gradient(ellipse,${C.accentGlow} 0%,transparent 68%)`, pointerEvents: 'none' }} />
      {/* Grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle,${C.border} 1px,transparent 1px)`, backgroundSize: '32px 32px', opacity: 0.3, pointerEvents: 'none' }} />

      <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3.5rem', maxWidth: '1200px', margin: '0 auto', width: '100%', position: 'relative' }}>
        <div style={{ animation: 'fadeInUp 0.65s ease both', animationDelay: '0.1s' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '4px 13px 4px 9px', borderRadius: '100px', border: `1px solid ${C.accentMid}`, background: C.accentDim, marginBottom: '1.625rem' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent }} />
            <span style={{ fontSize: '0.6875rem', color: C.accent, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
              Avaliação automática de imóveis · gratuito
            </span>
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.25rem,5.5vw,3.875rem)', fontWeight: 800, lineHeight: 1.04, letterSpacing: '-0.04em', marginBottom: '1.375rem', textWrap: 'pretty' }}>
            A FIPE<br />dos imóveis<br /><span style={{ color: C.accent }}>brasileiros</span>
          </h1>

          <p style={{ fontSize: 'clamp(0.9375rem,1.5vw,1.0625rem)', color: C.text2, lineHeight: 1.7, marginBottom: '2rem', maxWidth: '400px', textWrap: 'pretty' }}>
            Modelo automático de avaliação baseado em dados reais de mercado. Estimativas instantâneas para corretores e proprietários.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2.875rem' }}>
            <Link href="/#estimar" style={{ padding: '0.875rem 2rem', background: C.accent, color: '#000', textDecoration: 'none', fontSize: '0.9375rem', fontWeight: 700, borderRadius: '10px', transition: 'transform 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}>
              Estimar agora →
            </Link>
            <Link href="/metodologia" style={{ padding: '0.875rem 1.5rem', border: `1px solid ${C.border}`, color: C.text2, textDecoration: 'none', fontSize: '0.9375rem', fontWeight: 500, borderRadius: '10px', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.text; (e.currentTarget as HTMLElement).style.borderColor = C.borderMid; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.text2; (e.currentTarget as HTMLElement).style.borderColor = C.border; }}>
              Ver metodologia
            </Link>
          </div>

          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            {([['75+', 'bairros cobertos'], ['50k+', 'imóveis analisados'], ['±15%', 'de precisão'], ['Grátis', 'para sempre']] as [string,string][]).map(([v, l]) => (
              <div key={l}>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: '1.125rem', color: C.text, lineHeight: 1.2 }}>{v}</div>
                <div style={{ fontSize: '0.75rem', color: C.text2, marginTop: '3px' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ animation: 'fadeIn 0.75s ease 0.35s both' }}>
          <HeroChart />
        </div>
      </div>
    </section>
  );
}
