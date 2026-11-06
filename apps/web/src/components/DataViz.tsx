'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { tokens as C } from '@/lib/tokens';

interface HoodData {
  name: string;
  price: number;
  change: number;
}

const HOODS: HoodData[] = [
  { name: 'Batel', price: 12400, change: 2.1 },
  { name: 'Bigorrilho', price: 9800, change: 1.8 },
  { name: 'Jardim Social', price: 9200, change: 0.9 },
  { name: 'Cabral', price: 8600, change: 1.2 },
  { name: 'Água Verde', price: 8200, change: -0.3 },
  { name: 'Hugo Lange', price: 7900, change: 0.7 },
  { name: 'Mercês', price: 7600, change: 0.4 },
  { name: 'Alto da XV', price: 7200, change: 1.5 },
  { name: 'Centro', price: 6800, change: -0.8 },
  { name: 'Bacacheri', price: 6400, change: 0.2 },
  { name: 'Cristo Rei', price: 5600, change: 0.6 },
  { name: 'Portão', price: 5200, change: -0.1 },
  { name: 'Boa Vista', price: 5000, change: 0.3 },
  { name: 'Sítio Cercado', price: 3800, change: 1.1 },
];

const brlK = (n: number) => `R$\u00a0${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')}k`;

export function DataViz() {
  const [anim, setAnim] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const max = HOODS[0]!.price;

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry!.isIntersecting) setAnim(true);
      },
      { threshold: 0.15 },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      style={{
        padding: 'clamp(4rem,8vh,5.5rem) clamp(1rem,4vw,2.5rem)',
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '2.5rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <p
              style={{
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: C.accent,
                marginBottom: '0.75rem',
              }}
            >
              Demonstração com dados fictícios
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 'clamp(1.5rem,2.5vw,2rem)',
                letterSpacing: '-0.03em',
              }}
            >
              Exemplo ilustrativo de preços por m²
            </h2>
          </div>
          <p style={{ fontSize: '0.6875rem', color: C.text2, fontFamily: 'var(--font-mono)' }}>
            Sem dados reais ou variações verificadas
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {HOODS.map((h, i) => {
            const pct = (h.price / max) * 82;
            const pos = h.change >= 0;
            return (
              <div
                key={h.name}
                className="dviz-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '130px 1fr 76px 58px',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    fontSize: '0.8125rem',
                    color: C.text,
                    fontWeight: 500,
                    textAlign: 'right',
                  }}
                >
                  {h.name}
                </div>
                <div
                  style={{
                    height: '22px',
                    background: C.surface2,
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: anim ? `${pct}%` : '0%',
                      background: `linear-gradient(90deg,${C.accentMid},${C.accent})`,
                      borderRadius: '4px',
                      transition: `width 0.6s cubic-bezier(0.4,0,0.2,1) ${i * 0.048}s`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                    }}
                  >
                    {anim && pct > 22 && (
                      <span
                        style={{
                          paddingRight: '8px',
                          fontSize: '0.5625rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'rgba(0,0,0,0.7)',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {brlK(h.price)}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    color: C.text2,
                    textAlign: 'right',
                  }}
                >
                  {brlK(h.price)}/m²
                </div>
                <div
                  className="dviz-change"
                  style={{
                    fontSize: '0.6875rem',
                    fontFamily: 'var(--font-mono)',
                    color: pos ? C.positive : C.negative,
                    textAlign: 'right',
                  }}
                >
                  {pos ? '↑' : '↓'}
                  {Math.abs(h.change).toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: '1.75rem',
            display: 'flex',
            gap: '1.25rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span
              style={{ fontSize: '0.6875rem', color: C.positive, fontFamily: 'var(--font-mono)' }}
            >
              ↑ valorização
            </span>
            <span
              style={{ fontSize: '0.6875rem', color: C.negative, fontFamily: 'var(--font-mono)' }}
            >
              ↓ desvalorização
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <p style={{ fontSize: '0.6875rem', color: C.text3, fontFamily: 'var(--font-mono)' }}>
            Fontes: Zap Imóveis · OLX · VivaReal
          </p>
          <Link
            href="/metodologia"
            style={{
              fontSize: '0.6875rem',
              color: C.accent,
              textDecoration: 'none',
              fontFamily: 'var(--font-mono)',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '0.7';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '1';
            }}
          >
            Ver metodologia →
          </Link>
        </div>
      </div>
    </section>
  );
}
