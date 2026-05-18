'use client';

import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Nav }  from '@/components/Nav';
import { tokens as C } from '@/lib/tokens';

const PIPELINE = [
  { id: '01', phase: 'Coleta',        color: '#00d97e', title: 'Web scrapers automatizados',     stack: ['TypeScript','GitHub Actions','Neon Postgres','Playwright'], desc: 'Scrapers em TypeScript rodam diariamente via GitHub Actions, coletando anúncios do Zap Imóveis, OLX e VivaReal. Cada listagem bruta é armazenada em Neon Postgres com hash de deduplicação.' },
  { id: '02', phase: 'Normalização',  color: '#4f8ef7', title: 'Padronização e deduplicação',    stack: ['zod','pgvector','PostGIS'],                                  desc: 'O pacote normalizer converte listagens brutas para NormalizedListing: limpa endereços, resolve bairros via geocodificação, deduplica por hash e aplica filtros de outlier (±3σ por bairro/tipo).' },
  { id: '03', phase: 'Enriquecimento',color: '#f8b740', title: 'IPTU e dados geoespaciais',      stack: ['InfoSimples API','IPPUC','PostGIS'],                         desc: 'O pacote enrichment consulta a API InfoSimples para dados de IPTU e faz join geoespacial com dados do IPPUC (Curitiba), adicionando zona de uso e proximidade a parques.' },
  { id: '04', phase: 'Treinamento',   color: '#c084fc', title: 'ML em Python → ONNX',            stack: ['LightGBM','scikit-learn','ONNX Runtime','Python 3.12'],      desc: 'Modelo LightGBM treinado em Python com feature engineering: preço/m² histórico, índices de oferta/demanda e sazonalidade. Exportado como ONNX para inferência em Node.js.' },
  { id: '05', phase: 'Inferência',    color: '#38bdf8', title: 'API de estimativa em tempo real', stack: ['Cloudflare Workers','ONNX Runtime (Node)','Zod','TypeScript'], desc: 'O pacote ml-infer executa o ONNX em Node.js (Cloudflare Workers) com latência <100ms, retornando estimativa + intervalo de confiança 90% baseado em bootstrap OOB.' },
];

const METRICS = [
  { label: 'MAE (médio)',    value: 'R$\u00a048.200', desc: 'Erro médio absoluto · hold-out 20%' },
  { label: 'MAPE',           value: '12.4%',          desc: 'Erro percentual médio · bairros com >50 anúncios' },
  { label: 'R²',             value: '0.86',            desc: 'Coeficiente de determinação · teste set' },
  { label: 'Cobertura',      value: '75 bairros',      desc: 'Dados suficientes para estimar' },
  { label: 'Latência p99',   value: '<85ms',           desc: 'Inferência ONNX via Cloudflare Workers' },
  { label: 'Atualização',    value: 'Diária',          desc: 'Scrapers via GitHub Actions cron' },
];

const SOURCES = [
  { name: 'Zap Imóveis',         type: 'Anúncios',   coverage: 'Nacional',  freq: 'Diária',    weight: '40%' },
  { name: 'OLX',                  type: 'Anúncios',   coverage: 'Nacional',  freq: 'Diária',    weight: '30%' },
  { name: 'VivaReal',             type: 'Anúncios',   coverage: 'Nacional',  freq: 'Diária',    weight: '20%' },
  { name: 'InfoSimples / IPTU',   type: 'Registros',  coverage: 'Curitiba',  freq: 'Anual',     weight: '—'   },
  { name: 'IPPUC',                type: 'Geodados',   coverage: 'Curitiba',  freq: 'Eventual',  weight: '—'   },
];

export const runtime = 'edge';

export default function MetodologiaPage() {
  return (
    <div style={{ background: C.bg, minHeight: '100vh', paddingBottom: '5rem' }}>
      <Nav />

      {/* Hero */}
      <section style={{ padding: 'clamp(6rem,12vh,9rem) clamp(1rem,4vw,2.5rem) clamp(3rem,5vh,4rem)', position: 'relative', overflow: 'hidden', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ position: 'absolute', top: '10%', right: '-10%', width: '600px', height: '600px', background: `radial-gradient(ellipse,${C.accentGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle,${C.border} 1px,transparent 1px)`, backgroundSize: '32px 32px', opacity: 0.3, pointerEvents: 'none' }} />
        <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative', animation: 'fadeInUp 0.65s ease both' }}>
          <p style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent, marginBottom: '1rem' }}>Metodologia</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(2rem,5vw,3.5rem)', letterSpacing: '-0.04em', lineHeight: 1.07, marginBottom: '1.5rem' }}>
            Como o imovi<br /><span style={{ color: C.accent }}>calcula o valor</span><br />do seu imóvel
          </h1>
          <p style={{ fontSize: 'clamp(0.9375rem,1.5vw,1.125rem)', color: C.text2, lineHeight: 1.7, maxWidth: '600px' }}>
            Um pipeline de dados end-to-end — da coleta de anúncios à estimativa em tempo real. Fontes, modelo e critérios abertos para quem quiser auditar.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 clamp(1rem,4vw,2.5rem)' }}>

        {/* Pipeline */}
        <section style={{ paddingTop: 'clamp(3.5rem,7vh,5rem)', paddingBottom: 'clamp(3rem,5vh,4rem)', borderBottom: `1px solid ${C.border}` }}>
          <p style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent, marginBottom: '0.75rem' }}>Pipeline de dados</p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.5rem,2.5vw,2rem)', letterSpacing: '-0.03em', marginBottom: '2.5rem' }}>Do anúncio à estimativa</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {PIPELINE.map((step, i) => (
              <div key={step.id} style={{ display: 'flex', gap: '1.5rem', paddingBottom: '2rem', position: 'relative' }}>
                {i < PIPELINE.length - 1 && <div style={{ position: 'absolute', left: '19px', top: '44px', bottom: 0, width: '2px', background: `linear-gradient(${step.color}40,${PIPELINE[i+1]!.color}20)` }} />}
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: C.surface2, border: `2px solid ${step.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', zIndex: 1 }}>
                  <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', fontWeight: 500, color: step.color }}>{step.id}</span>
                </div>
                <div style={{ flex: 1, paddingTop: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.5875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.12em', color: step.color }}>{step.phase}</span>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.0625rem' }}>{step.title}</h3>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: C.text2, lineHeight: 1.7, marginBottom: '0.875rem' }}>{step.desc}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {step.stack.map(s => <span key={s} style={{ padding: '2px 9px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '4px', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: C.text2 }}>{s}</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Metrics */}
        <section style={{ paddingTop: 'clamp(3.5rem,7vh,5rem)', paddingBottom: 'clamp(3rem,5vh,4rem)', borderBottom: `1px solid ${C.border}` }}>
          <p style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent, marginBottom: '0.75rem' }}>Performance</p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.5rem,2.5vw,2rem)', letterSpacing: '-0.03em', marginBottom: '2rem' }}>Métricas do modelo</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '1rem' }}>
            {METRICS.map(m => (
              <div key={m.label} style={{ padding: '1.25rem', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', transition: 'border-color 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.borderMid; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}>
                <p style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.12em', color: C.text2, marginBottom: '6px' }}>{m.label}</p>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.625rem', fontWeight: 500, color: C.accent, letterSpacing: '-0.02em', marginBottom: '4px' }}>{m.value}</div>
                <p style={{ fontSize: '0.75rem', color: C.text3, lineHeight: 1.5 }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sources */}
        <section style={{ paddingTop: 'clamp(3.5rem,7vh,5rem)', paddingBottom: 'clamp(3rem,5vh,4rem)' }}>
          <p style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent, marginBottom: '0.75rem' }}>Fontes de dados</p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.5rem,2.5vw,2rem)', letterSpacing: '-0.03em', marginBottom: '2rem' }}>De onde vêm os dados</h2>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', padding: '0.75rem 1.25rem', background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
              {['Fonte','Tipo','Cobertura','Frequência','Peso'].map(h => <span key={h} style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.text2 }}>{h}</span>)}
            </div>
            {SOURCES.map((s, i) => (
              <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', padding: '0.875rem 1.25rem', borderBottom: i < SOURCES.length - 1 ? `1px solid ${C.border}` : 'none', transition: 'background 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.surface2; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: C.text }}>{s.name}</span>
                <span style={{ fontSize: '0.8125rem', color: C.text2 }}>{s.type}</span>
                <span style={{ fontSize: '0.8125rem', color: C.text2 }}>{s.coverage}</span>
                <span style={{ fontSize: '0.8125rem', color: C.text2 }}>{s.freq}</span>
                <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: s.weight === '—' ? C.text3 : C.accent }}>{s.weight}</span>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div style={{ padding: '2rem', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '4rem' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', marginBottom: '0.375rem' }}>Pronto para testar?</h3>
            <p style={{ color: C.text2, fontSize: '0.9rem' }}>Estime o valor de um imóvel agora — gratuito, sem cadastro.</p>
          </div>
          <Link href="/#estimar" style={{ padding: '0.875rem 2rem', background: C.accent, color: '#000', textDecoration: 'none', fontSize: '0.9375rem', fontWeight: 700, borderRadius: '10px', transition: 'transform 0.15s', whiteSpace: 'nowrap' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}>
            Estimar agora →
          </Link>
        </div>
      </div>
    </div>
  );
}
