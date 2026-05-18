'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { tokens as C } from '@/lib/tokens';

const brl  = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brlK = (n: number) => `R$\u00a0${(n / 1000).toFixed(0).replace('.', ',')}k`;

const ESTIMATES = [
  { id: 'e001', addr: 'Ap. 2q · Batel',          area: 85,  type: 'Ap.',    estimate: 1054000, low: 901000,  high: 1207000, hood: 'Batel',         date: '16/05/25 14:32' },
  { id: 'e002', addr: 'Casa 3q · Água Verde',     area: 200, type: 'Casa',   estimate: 1680000, low: 1430000, high: 1930000, hood: 'Água Verde',    date: '16/05/25 11:15' },
  { id: 'e003', addr: 'Ap. 1q · Centro',          area: 45,  type: 'Ap.',    estimate: 312000,  low: 265000,  high: 359000,  hood: 'Centro',        date: '15/05/25 18:40' },
  { id: 'e004', addr: 'Comercial · Bigorrilho',   area: 120, type: 'Com.',   estimate: 988000,  low: 840000,  high: 1136000, hood: 'Bigorrilho',    date: '15/05/25 09:22' },
  { id: 'e005', addr: 'Ap. 3q · Jardim Social',  area: 130, type: 'Ap.',    estimate: 1196000, low: 1017000, high: 1375000, hood: 'Jardim Social', date: '14/05/25 16:55' },
  { id: 'e006', addr: 'Terreno · Bacacheri',      area: 600, type: 'Terra.', estimate: 820000,  low: 697000,  high: 943000,  hood: 'Bacacheri',     date: '13/05/25 08:30' },
];

const PORTFOLIO = [
  { name: 'Ed. Rio Branco 804',           hood: 'Batel',      area: 92,  type: 'Ap.',  val: 1100000, change:  2.1, est: '16/05/25' },
  { name: 'R. Comendador Araújo 320',     hood: 'Bigorrilho', area: 75,  type: 'Ap.',  val: 735000,  change:  1.8, est: '14/05/25' },
  { name: 'Al. Carlos de Carvalho 88',    hood: 'Água Verde', area: 180, type: 'Casa', val: 1480000, change: -0.3, est: '10/05/25' },
];

const VOLUME_DATA = [
  { month: 'Nov', count: 12 }, { month: 'Dez', count: 18 }, { month: 'Jan', count: 15 },
  { month: 'Fev', count: 24 }, { month: 'Mar', count: 20 }, { month: 'Abr', count: 31 }, { month: 'Mai', count: 27 },
];
const HOOD_DATA = [
  { name: 'Batel',      count: 18 }, { name: 'Bigorrilho', count: 14 },
  { name: 'Água Verde', count: 11 }, { name: 'Centro',     count: 9  },
  { name: 'Bacacheri',  count: 6  }, { name: 'Outros',     count: 22 },
];

const NAV_ITEMS = [
  { id: 'overview',   label: 'Visão geral' },
  { id: 'estimates',  label: 'Estimativas' },
  { id: 'portfolio',  label: 'Portfólio'   },
  { id: 'market',     label: 'Mercado'     },
  { id: 'api',        label: 'API'         },
];

function VolumeChart() {
  const [anim, setAnim] = useState(false);
  const max = Math.max(...VOLUME_DATA.map(d => d.count));
  useEffect(() => { const t = setTimeout(() => setAnim(true), 400); return () => clearTimeout(t); }, []);
  return (
    <div style={{ height: '100px', display: 'flex', alignItems: 'flex-end', gap: '6px', paddingTop: '8px' }}>
      {VOLUME_DATA.map((d, i) => (
        <div key={d.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: '0.5875rem', fontFamily: 'var(--font-mono)', color: i === VOLUME_DATA.length - 1 ? C.accent : C.text3, opacity: anim ? 1 : 0, transition: `opacity 0.3s ease ${i * 0.08}s` }}>{d.count}</div>
          <div style={{ width: '100%', background: C.surface2, borderRadius: '3px 3px 0 0', overflow: 'hidden', height: '70px', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', background: i === VOLUME_DATA.length - 1 ? C.accent : C.accentMid, borderRadius: '3px 3px 0 0', height: anim ? `${(d.count / max) * 100}%` : '0%', transition: `height 0.5s cubic-bezier(0.4,0,0.2,1) ${i * 0.07}s` }}/>
          </div>
          <div style={{ fontSize: '0.5875rem', color: C.text3, fontFamily: 'var(--font-mono)' }}>{d.month}</div>
        </div>
      ))}
    </div>
  );
}

function OverviewTab() {
  return (
    <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.3s ease both' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }}>
        {[
          { label: 'Estimativas este mês', val: '27',         delta: '+38%', up: true,  sub: 'vs. mês anterior' },
          { label: 'Valor total estimado', val: 'R$\u00a028,4M', delta: '+12%', up: true,  sub: 'portfólio'        },
          { label: 'Bairro mais consultado',val: 'Batel',     delta: null,   up: null,  sub: '18 consultas'     },
          { label: 'Precisão média',        val: '±15%',      delta: null,   up: null,  sub: 'bairros com alto volume' },
        ].map(k => (
          <div key={k.label} style={{ padding: '1.125rem', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', transition: 'border-color 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.borderMid; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}>
            <p style={{ fontSize: '0.6875rem', color: C.text2, marginBottom: '6px' }}>{k.label}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 500, letterSpacing: '-0.02em', color: C.text, lineHeight: 1.1, marginBottom: '4px' }}>{k.val}</p>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {k.delta && <span style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', color: k.up ? C.positive : C.negative }}>{k.delta}</span>}
              <span style={{ fontSize: '0.625rem', color: C.text3 }}>{k.sub}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.25rem' }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '1.25rem' }}>
          <p style={{ fontSize: '0.5875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.12em', color: C.accent, marginBottom: '3px' }}>Atividade</p>
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: C.text, marginBottom: '1rem' }}>Estimativas por mês</p>
          <VolumeChart />
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '1.25rem' }}>
          <p style={{ fontSize: '0.5875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.12em', color: C.accent, marginBottom: '3px' }}>Distribuição</p>
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: C.text, marginBottom: '1rem' }}>Consultas por bairro</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {HOOD_DATA.map((h, i) => (
              <div key={h.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '72px', fontSize: '0.6875rem', color: C.text2, textAlign: 'right', flexShrink: 0 }}>{h.name}</div>
                <div style={{ flex: 1, height: '14px', background: C.surface2, borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(h.count / HOOD_DATA[0]!.count) * 100}%`, background: i === 0 ? C.accent : C.accentMid, borderRadius: '3px' }}/>
                </div>
                <div style={{ width: '22px', fontSize: '0.625rem', fontFamily: 'var(--font-mono)', color: C.text2, textAlign: 'right', flexShrink: 0 }}>{h.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.5875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.12em', color: C.accent, marginBottom: '2px' }}>Recentes</p>
            <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: C.text }}>Últimas estimativas</p>
          </div>
          <Link href="/#estimar" style={{ fontSize: '0.8125rem', color: C.accent, textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>+ Nova →</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 80px', padding: '0.625rem 1.25rem', background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
          {['Imóvel','Bairro','Estimativa','Intervalo','Data'].map(h => <span key={h} style={{ fontSize: '0.5875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.text2 }}>{h}</span>)}
        </div>
        {ESTIMATES.map((e, i) => (
          <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 80px', padding: '0.875rem 1.25rem', borderBottom: i < ESTIMATES.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center', transition: 'background 0.15s', cursor: 'pointer' }}
            onMouseEnter={el => { (el.currentTarget as HTMLElement).style.background = C.surface2; }}
            onMouseLeave={el => { (el.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            <div><div style={{ fontSize: '0.875rem', fontWeight: 500, color: C.text }}>{e.addr}</div><div style={{ fontSize: '0.6875rem', color: C.text2 }}>{e.area}m² · {e.type}</div></div>
            <span style={{ fontSize: '0.8125rem', color: C.text2 }}>{e.hood}</span>
            <span style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)', color: C.text }}>{brl(e.estimate)}</span>
            <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: C.text3 }}>{brlK(e.low)}–{brlK(e.high)}</span>
            <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: C.text3 }}>{e.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PortfolioTab() {
  const total = PORTFOLIO.reduce((s, p) => s + p.val, 0);
  return (
    <div style={{ padding: '1.75rem', animation: 'fadeIn 0.3s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <p style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent, marginBottom: '4px' }}>Portfólio monitorado</p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.375rem', letterSpacing: '-0.03em' }}>Meus imóveis</h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.625rem', color: C.text2, marginBottom: '3px' }}>Valor total estimado</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 500, color: C.text }}>{brl(total)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {PORTFOLIO.map((p, i) => (
          <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', transition: 'border-color 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.borderMid; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: C.surface2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: C.text, marginBottom: '3px' }}>{p.name}</div>
                <div style={{ fontSize: '0.75rem', color: C.text2 }}>{p.hood} · {p.area}m² · {p.type}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.625rem', color: C.text2, marginBottom: '2px' }}>Estimativa atual</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.125rem', fontWeight: 500, color: C.text }}>{brl(p.val)}</div>
              </div>
              <div style={{ padding: '4px 10px', borderRadius: '6px', background: p.change >= 0 ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${p.change >= 0 ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`, color: p.change >= 0 ? C.positive : C.negative, fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                {p.change >= 0 ? '↑' : '↓'}{Math.abs(p.change).toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
        <Link href="/#estimar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '1.125rem', background: C.surface, border: `1px dashed ${C.border}`, borderRadius: '14px', color: C.text2, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, transition: 'all 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.accent; (e.currentTarget as HTMLElement).style.color = C.accent; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.color = C.text2; }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Adicionar imóvel
        </Link>
      </div>
    </div>
  );
}

export const runtime = 'edge';

export default function DashboardPage() {
  const [active, setActive] = useState('overview');

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{ width: '220px', flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}` }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none' }}>
            <svg width="22" height="19" viewBox="0 0 28 24" fill="none"><rect x="0" y="16" width="7" height="8" rx="1.5" fill={C.accent}/><rect x="10.5" y="10" width="7" height="14" rx="1.5" fill={C.accent} fillOpacity=".6"/><rect x="21" y="4" width="7" height="20" rx="1.5" fill={C.accent} fillOpacity=".3"/><polyline points="3.5,16 14,10 24.5,4" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" strokeOpacity=".55" fill="none"/></svg>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '19px', color: C.text, letterSpacing: '-0.04em' }}>imovi</span>
          </Link>
        </div>
        <div style={{ margin: '1rem', padding: '0.625rem 0.875rem', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '9px' }}>
          <div style={{ fontSize: '0.5875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.text2, marginBottom: '3px' }}>Plano atual</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.text }}>Gratuito</span>
            <Link href="/precos" style={{ fontSize: '0.625rem', color: C.accent, textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>→ Pro</Link>
          </div>
        </div>
        <nav style={{ flex: 1, padding: '0.375rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActive(item.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '0.5625rem 0.75rem', background: active === item.id ? C.accentDim : 'transparent', border: `1px solid ${active === item.id ? C.accentMid : 'transparent'}`, borderRadius: '7px', color: active === item.id ? C.accent : C.text2, fontSize: '0.875rem', fontWeight: active === item.id ? 600 : 400, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' }}>
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '0.75rem', borderTop: `1px solid ${C.border}` }}>
          <div style={{ padding: '0.75rem', background: C.surface2, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: C.accentDim, border: `1px solid ${C.accentMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: C.accent }}>JC</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>João Corretor</div>
              <div style={{ fontSize: '0.6875rem', color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>CRECI/PR 12345</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: C.text }}>
            {{ overview: 'Visão geral', estimates: 'Estimativas', portfolio: 'Portfólio', market: 'Dados de mercado', api: 'Integração API' }[active]}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '7px' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, animation: 'pulse 2.5s ease infinite' }}/>
              <span style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', color: C.text2 }}>dados ao vivo</span>
            </div>
            <Link href="/#estimar" style={{ padding: '0.4375rem 1rem', background: C.accent, color: '#000', textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 700, borderRadius: '7px' }}>
              + Estimar
            </Link>
          </div>
        </header>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {(active === 'overview' || active === 'estimates') && <OverviewTab />}
          {active === 'portfolio' && <PortfolioTab />}
          {(active === 'market' || active === 'api') && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '4rem 2rem', animation: 'fadeIn 0.3s ease both' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: C.surface, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, animation: 'pulse 2s ease infinite' }}/>
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.125rem' }}>
                {{ market: 'Dados de mercado', api: 'Integração via API' }[active]}
              </p>
              <p style={{ fontSize: '0.875rem', color: C.text2 }}>Disponível no plano Profissional</p>
              <Link href="/precos" style={{ padding: '0.625rem 1.25rem', background: C.accentDim, border: `1px solid ${C.accentMid}`, color: C.accent, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, borderRadius: '8px' }}>
                Ver planos →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
