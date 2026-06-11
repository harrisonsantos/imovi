'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { tokens as C } from '@/lib/tokens';

/**
 * Resultados page — shows a full estimate report.
 *
 * TODO: wire to real data by passing the estimate result via:
 *   - searchParams (?estimate=1054000&hood=Batel&area=85…)
 *   - or a server-side session after form submission
 *
 * The component structure and visuals are complete; only the data source needs replacing.
 */

const brl  = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brlK = (n: number) => `R$\u00a0${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')}k`;

// Representative mock — replace with real data from API response or searchParams
const REPORT = {
  type: 'Apartamento', area: 85, bedrooms: 2, bathrooms: 2, parking: 1,
  estimate: 1054000, low: 901000, high: 1217000,
  priceM2: 12400, hoodMedian: 12400, hoodChange: 2.1,
  generatedAt: new Date().toLocaleString('pt-BR'),
  neighborhood: 'Batel',
  features: { 'Área (m²)': 0.38, 'Bairro': 0.31, 'Tipo': 0.14, 'Quartos': 0.09, 'Vagas': 0.05, 'Banheiros': 0.03 },
  comparables: [
    { name: 'Ap. 2q, 78m²', hood: 'Batel',      price: 980000,  m2: 12564, dist: 180,  status: 'vendido'  },
    { name: 'Ap. 2q, 91m²', hood: 'Batel',      price: 1120000, m2: 12308, dist: 320,  status: 'anunciado'},
    { name: 'Ap. 3q, 88m²', hood: 'Bigorrilho', price: 1050000, m2: 11931, dist: 810,  status: 'vendido'  },
    { name: 'Ap. 2q, 82m²', hood: 'Batel',      price: 1020000, m2: 12439, dist: 210,  status: 'anunciado'},
    { name: 'Ap. 2q, 90m²', hood: 'Cabral',     price: 870000,  m2: 9666,  dist: 1200, status: 'anunciado'},
    { name: 'Ap. 3q, 95m²', hood: 'Água Verde', price: 985000,  m2: 10368, dist: 1500, status: 'vendido'  },
  ],
  priceHistory: [
    { month: 'Nov/24', price: 11800 }, { month: 'Dez/24', price: 11950 },
    { month: 'Jan/25', price: 12100 }, { month: 'Fev/25', price: 12000 },
    { month: 'Mar/25', price: 12150 }, { month: 'Abr/25', price: 12280 },
    { month: 'Mai/25', price: 12400 },
  ],
};

// ── Price history SVG chart ────────────────────────────────────────────────
function PriceHistoryChart() {
  const [anim, setAnim] = useState(false);
  const data = REPORT.priceHistory;
  const min  = Math.min(...data.map(d => d.price)) - 300;
  const max  = Math.max(...data.map(d => d.price)) + 300;
  const W = 400, H = 120, pad = { t: 12, r: 16, b: 32, l: 8 };
  const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  const pts = data.map((d, i) => ({
    x: pad.l + i * (cw / (data.length - 1)),
    y: pad.t + ch - ((d.price - min) / (max - min)) * ch,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = pathD + ` L${pts[pts.length-1]!.x.toFixed(1)},${H-pad.b} L${pts[0]!.x.toFixed(1)},${H-pad.b} Z`;

  useEffect(() => { const t = setTimeout(() => setAnim(true), 300); return () => clearTimeout(t); }, []);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.accent} stopOpacity="0.15"/>
          <stop offset="100%" stopColor={C.accent} stopOpacity="0"/>
        </linearGradient>
        <clipPath id="histClip">
          <rect x="0" y="0" width={anim ? W : 0} height={H} style={{ transition: 'width 1.2s ease 0.3s' }}/>
        </clipPath>
      </defs>
      {[0, 0.5, 1].map(r => <line key={r} x1={pad.l} y1={pad.t + ch * r} x2={W - pad.r} y2={pad.t + ch * r} stroke={C.border} strokeWidth="1"/>)}
      <path d={areaD} fill="url(#histGrad)" clipPath="url(#histClip)"/>
      <path d={pathD} stroke={C.accent} strokeWidth="1.5" fill="none" strokeLinecap="round" clipPath="url(#histClip)"/>
      {anim && pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4 : 2.5} fill={i === pts.length - 1 ? C.accent : C.surface} stroke={C.accent} strokeWidth="1.5" style={{ animation: 'fadeIn 0.3s ease both', animationDelay: `${0.3 + i * 0.12}s` }}/>)}
      {pts.map((p, i) => <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill={C.text2} fontFamily="var(--font-mono)">{data[i]!.month.split('/')[0]}</text>)}
      {[0, pts.length - 1].map(i => <text key={i} x={pts[i]!.x} y={pts[i]!.y - 8} textAnchor="middle" fontSize="8" fill={C.accent} fontFamily="var(--font-mono)" style={{ opacity: anim ? 1 : 0, transition: `opacity 0.3s ease ${0.3 + i * 0.12}s` }}>{brlK(data[i]!.price)}</text>)}
    </svg>
  );
}

// ── Feature importance bars ────────────────────────────────────────────────
function FeatureBars() {
  const [anim, setAnim] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e!.isIntersecting) setAnim(true); }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {Object.entries(REPORT.features).map(([feat, imp], i) => (
        <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '130px', fontSize: '0.75rem', color: C.text2, textAlign: 'right', flexShrink: 0 }}>{feat}</div>
          <div style={{ flex: 1, height: '14px', background: C.surface2, borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: anim ? `${imp * 100}%` : '0%', background: C.accent, borderRadius: '3px', opacity: 1 - i * 0.08, transition: `width 0.55s cubic-bezier(0.4,0,0.2,1) ${i * 0.08}s` }}/>
          </div>
          <div style={{ width: '36px', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: C.accent, textAlign: 'right', flexShrink: 0 }}>{(imp * 100).toFixed(0)}%</div>
        </div>
      ))}
    </div>
  );
}

export const runtime = 'edge';

export default function ResultadosPage() {
  return (
    <div style={{ background: C.bg, minHeight: '100vh', paddingBottom: '4rem' }}>
      <nav style={{ height: '60px', display: 'flex', alignItems: 'center', padding: '0 clamp(1rem,4vw,2.5rem)', background: 'rgba(7,9,14,0.93)', backdropFilter: 'blur(18px)', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 100 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none', userSelect: 'none' }}>
          <svg width="22" height="19" viewBox="0 0 28 24" fill="none"><rect x="0" y="16" width="7" height="8" rx="1.5" fill={C.accent}/><rect x="10.5" y="10" width="7" height="14" rx="1.5" fill={C.accent} fillOpacity=".6"/><rect x="21" y="4" width="7" height="20" rx="1.5" fill={C.accent} fillOpacity=".3"/><polyline points="3.5,16 14,10 24.5,4" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" strokeOpacity=".55" fill="none"/></svg>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '19px', color: C.text, letterSpacing: '-0.04em' }}>imovi</span>
        </Link>
        <div style={{ flex: 1 }}/>
        <Link href="/" style={{ padding: '0.4375rem 0.875rem', color: C.text2, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, borderRadius: '6px', transition: 'all 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.text; (e.currentTarget as HTMLElement).style.background = C.surface2; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.text2; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
          ← Nova estimativa
        </Link>
        <button onClick={() => window.print()} style={{ marginLeft: '0.75rem', padding: '0.5rem 1.25rem', background: C.accentDim, border: `1px solid ${C.accentMid}`, color: C.accent, fontSize: '0.875rem', fontWeight: 600, borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'background 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.accentMid; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.accentDim; }}>
          Exportar PDF
        </button>
      </nav>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2.5rem clamp(1rem,4vw,2.5rem) 0' }}>
        {/* Header */}
        <div style={{ marginBottom: '2.5rem', animation: 'fadeInUp 0.55s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent }}>Relatório de Estimativa</span>
            <span style={{ fontSize: '0.625rem', color: C.text3, fontFamily: 'var(--font-mono)' }}>· {REPORT.generatedAt}</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.75rem,4vw,2.625rem)', letterSpacing: '-0.04em', marginBottom: '0.375rem' }}>
            {REPORT.type} · {REPORT.neighborhood}
          </h1>
          <p style={{ color: C.text2, fontSize: '0.9375rem' }}>
            {REPORT.area}m² · {REPORT.bedrooms} quartos · {REPORT.bathrooms} banheiros · {REPORT.parking} vaga
          </p>
        </div>

        {/* Main estimate */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '18px', padding: '2rem', marginBottom: '1.5rem', position: 'relative', overflow: 'hidden', animation: 'fadeInUp 0.55s ease 0.1s both' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '350px', height: '350px', background: `radial-gradient(ellipse at 80% 20%,${C.accentGlow} 0%,transparent 70%)`, pointerEvents: 'none' }}/>
          <div className="res-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', position: 'relative' }}>
            <div>
              <p style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent, marginBottom: '6px' }}>Valor estimado de mercado</p>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(2.25rem,5vw,3.5rem)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '1.25rem' }}>{brl(REPORT.estimate)}</div>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.6875rem', color: C.text2 }}>Intervalo de confiança 90%</span>
                </div>
                <div style={{ position: 'relative', height: '36px', background: C.surface2, borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: '9%', right: '9%', top: '25%', bottom: '25%', background: C.accentDim, borderRadius: '4px', border: `1px solid ${C.accentMid}` }}/>
                  <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '10%', bottom: '10%', width: '2px', background: C.accent, borderRadius: '1px' }}/>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4375rem' }}>
                  <div><div style={{ fontSize: '0.5875rem', color: C.text3, fontFamily: 'var(--font-mono)', marginBottom: '1px' }}>mínimo</div><div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: C.text2 }}>{brl(REPORT.low)}</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: '0.5875rem', color: C.accent, fontFamily: 'var(--font-mono)', marginBottom: '1px' }}>estimativa</div><div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: C.accent, fontWeight: 500 }}>{brl(REPORT.estimate)}</div></div>
                  <div style={{ textAlign: 'right' }}><div style={{ fontSize: '0.5875rem', color: C.text3, fontFamily: 'var(--font-mono)', marginBottom: '1px' }}>máximo</div><div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: C.text2 }}>{brl(REPORT.high)}</div></div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {([['Preço/m² estimado', `${brl(REPORT.priceM2)}/m²`], ['Mediana do bairro', `${brl(REPORT.hoodMedian)}/m²`], ['Variação 30d', `↑ ${REPORT.hoodChange.toFixed(1)}% (${REPORT.neighborhood})`], ['Área', `${REPORT.area} m²`], ['Comparáveis', '6 imóveis'], ['Gerado em', REPORT.generatedAt]] as [string,string][]).map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: C.surface2, borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: C.text2 }}>{l}</span>
                  <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: l === 'Variação 30d' ? C.positive : C.text }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comparables + Feature importance */}
        <div className="res-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', animation: 'fadeInUp 0.55s ease 0.2s both' }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '1.5rem' }}>
            <p style={{ fontSize: '0.5875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent, marginBottom: '4px' }}>Comparáveis</p>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', marginBottom: '1.25rem' }}>Imóveis similares recentes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {REPORT.comparables.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: C.surface2, borderRadius: '8px', gap: '0.75rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: C.text, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: '0.6875rem', color: C.text2 }}>{c.hood} · {c.dist}m · <span style={{ color: c.status === 'vendido' ? C.positive : C.text3 }}>{c.status}</span></div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)', color: C.text }}>{brlK(c.price)}</div>
                    <div style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', color: C.text2 }}>{c.m2.toLocaleString('pt-BR')}/m²</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '1.5rem' }}>
            <p style={{ fontSize: '0.5875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent, marginBottom: '4px' }}>Modelo</p>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', marginBottom: '1.25rem' }}>Importância das features</h3>
            <FeatureBars />
            <div style={{ marginTop: '1.25rem', padding: '0.875rem', background: C.surface2, borderRadius: '8px' }}>
              <p style={{ fontSize: '0.75rem', color: C.text2, lineHeight: 1.6 }}>Localização (bairro + área) responde por <span style={{ color: C.accent, fontWeight: 600 }}>69%</span> do valor estimado.</p>
            </div>
          </div>
        </div>

        {/* Price history */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '1.5rem', animation: 'fadeInUp 0.55s ease 0.3s both' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div>
              <p style={{ fontSize: '0.5875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent, marginBottom: '4px' }}>Histórico</p>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem' }}>Evolução do preço/m² em {REPORT.neighborhood}</h3>
            </div>
            <span style={{ fontSize: '0.6875rem', color: C.positive, fontFamily: 'var(--font-mono)' }}>
              +{(((REPORT.priceHistory[REPORT.priceHistory.length-1]!.price - REPORT.priceHistory[0]!.price) / REPORT.priceHistory[0]!.price) * 100).toFixed(1)}% em 6 meses
            </span>
          </div>
          <PriceHistoryChart />
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <p style={{ fontSize: '0.75rem', color: C.text3, lineHeight: 1.55, maxWidth: '500px' }}>Os valores exibidos são estimativas e não constituem laudo de avaliação.</p>
          <Link href="/" style={{ padding: '0.75rem 1.5rem', background: C.accentDim, border: `1px solid ${C.accentMid}`, color: C.accent, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, borderRadius: '9px', transition: 'background 0.15s', whiteSpace: 'nowrap' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.accentMid; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.accentDim; }}>
            Nova estimativa →
          </Link>
        </div>
      </div>
    </div>
  );
}
