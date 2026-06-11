'use client';

import Script from 'next/script';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { tokens as C } from '@/lib/tokens';

// ── Types (from original estimate-form.tsx) ────────────────────────────────
type PropertyType = 'apartment' | 'house' | 'commercial' | 'land';

interface Neighborhood {
  name:           string;
  medianPriceM2:  number | null;
}

interface City {
  name:   string;
  state:  string;
  slug:   string;
}

interface EstimateResponse {
  estimate:         number;
  confidenceLow:    number;
  confidenceHigh:   number;
  modelVersion:     string;
  featuresUsed:     Record<string, number>;
  neighborhood:     { name: string; medianPriceM2: number };
}

interface EstimateFormProps {
  siteKey?: string | undefined;
}

declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void;
    turnstile?: { reset: (widget?: string | HTMLElement) => void };
  }
}

const PROPERTY_TYPES: [PropertyType, string][] = [
  ['apartment', 'Apartamento'],
  ['house',     'Casa'],
  ['commercial','Comercial'],
  ['land',      'Terreno'],
];

const brl  = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brlK = (n: number) => `R$\u00a0${(n / 1000).toFixed(0).replace('.', ',')}k`;

// ── Shared input style ─────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width:        '100%',
  padding:      '0.6875rem 0.875rem',
  background:   C.surface3,
  border:       `1px solid ${C.border}`,
  borderRadius: '8px',
  color:        C.text,
  fontSize:     '0.875rem',
  fontFamily:   'var(--font-body)',
  transition:   'border-color 0.15s',
};
const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor:          'pointer',
  paddingRight:    '2.25rem',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%235e7080' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat:   'no-repeat',
  backgroundPosition: 'right 0.75rem center',
  appearance:         'none',
};
const labelStyle: React.CSSProperties = {
  display:      'block',
  fontSize:     '0.75rem',
  fontWeight:   500,
  color:        C.text2,
  marginBottom: '0.3125rem',
};

// ── Component ──────────────────────────────────────────────────────────────
export function EstimateForm({ siteKey }: EstimateFormProps = {}) {
  const [cities,        setCities]          = useState<City[]>([]);
  const [selectedCity,  setSelectedCity]    = useState<City | null>(null);
  const [loadingCities, setLoadingCities]   = useState(true);
  const [cityError,     setCityError]       = useState<string | null>(null);

  const [neighborhoods, setNeighborhoods]   = useState<Neighborhood[]>([]);
  const [loadingHoods,  setLoadingHoods]    = useState(true);
  const [hoodError,     setHoodError]       = useState<string | null>(null);

  const [neighborhood, setNeighborhood] = useState('');
  const [area,         setArea]         = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [bedrooms,     setBedrooms]     = useState('');
  const [bathrooms,    setBathrooms]    = useState('');
  const [parking,      setParking]      = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [result,       setResult]       = useState<EstimateResponse | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const turnstileEnabled = Boolean(siteKey);

  // Expose Turnstile callback globally
  useEffect(() => {
    if (!turnstileEnabled) return;
    window.onTurnstileSuccess = (token: string) => setTurnstileToken(token);
    return () => { delete window.onTurnstileSuccess; };
  }, [turnstileEnabled]);

  // Fetch cities (cobertas) no mount
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res  = await fetch('/api/cities');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { cities: City[] };
        if (cancelled) return;
        setCities(data.cities);
        // Default: Curitiba/PR se presente, senão a primeira da lista.
        const def = data.cities.find(c => c.name === 'Curitiba' && c.state === 'PR') ?? data.cities[0];
        if (def) setSelectedCity(def);
      } catch (err) {
        if (!cancelled) setCityError((err as Error).message);
      } finally {
        if (!cancelled) setLoadingCities(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch neighborhoods (refeito ao trocar de cidade)
  useEffect(() => {
    if (!selectedCity) return;
    let cancelled = false;
    setLoadingHoods(true);
    setHoodError(null);
    setNeighborhood('');
    void (async () => {
      try {
        const qs   = new URLSearchParams({ city: selectedCity.name, state: selectedCity.state });
        const res  = await fetch(`/api/neighborhoods?${qs.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Neighborhood[];
        if (cancelled) return;
        setNeighborhoods(data);
        const first = data[0];
        if (first) setNeighborhood(first.name);
      } catch (err) {
        if (!cancelled) setHoodError((err as Error).message);
      } finally {
        if (!cancelled) setLoadingHoods(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCity]);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null); setResult(null);

    const areaNum = Number(area);
    if (!Number.isFinite(areaNum) || areaNum <= 0) { setError('Informe uma área válida em m².'); return; }
    if (!selectedCity) { setError('Selecione uma cidade.'); return; }
    if (!neighborhood) { setError('Selecione um bairro.'); return; }

    const payload: Record<string, unknown> = {
      city: selectedCity.name, state: selectedCity.state,
      neighborhood, area: areaNum, propertyType,
    };
    if (bedrooms)  payload.bedrooms  = Number(bedrooms);
    if (bathrooms) payload.bathrooms = Number(bathrooms);
    if (parking)   payload.parking   = Number(parking);
    if (turnstileToken) payload.turnstileToken = turnstileToken;

    setSubmitting(true);
    try {
      const res  = await fetch('/api/estimate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = (await res.json()) as EstimateResponse | { error: string; message: string };
      if (!res.ok) { setError('message' in data ? data.message : 'Erro desconhecido.'); return; }
      setResult(data as EstimateResponse);
    } catch (err) {
      setError(`Falha de rede: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
      if (turnstileEnabled) {
        setTurnstileToken(null);
        window.turnstile?.reset();
      }
    }
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    (e.target as HTMLElement).style.borderColor = C.accentMid;
  }
  function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    (e.target as HTMLElement).style.borderColor = C.border;
  }

  return (
    <>
      {turnstileEnabled && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" async defer />
      )}

      <section id="estimar" style={{ padding: 'clamp(4rem,8vh,5.5rem) clamp(1rem,4vw,2.5rem)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3.5rem', alignItems: 'start' }}>

            {/* ── Left: form ── */}
            <div>
              <p style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent, marginBottom: '0.75rem' }}>
                Estimativa gratuita
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.75rem,3vw,2.375rem)', letterSpacing: '-0.03em', marginBottom: '0.75rem' }}>
                Quanto vale o seu imóvel?
              </h2>
              <p style={{ color: C.text2, marginBottom: '2rem', lineHeight: 1.65, fontSize: '0.9375rem' }}>
                Sem cadastro. Sem custo. Resultado em segundos.
              </p>

              <form onSubmit={onSubmit} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Cidade */}
                <div>
                  <label style={labelStyle}>Cidade</label>
                  <select
                    value={selectedCity ? selectedCity.slug : ''}
                    onChange={e => {
                      const next = cities.find(c => c.slug === e.target.value);
                      if (next) setSelectedCity(next);
                    }}
                    disabled={loadingCities || !!cityError}
                    required
                    style={selectStyle}
                    onFocus={handleFocus} onBlur={handleBlur}
                    aria-describedby={cityError ? 'city-error' : undefined}
                  >
                    {loadingCities && <option>Carregando cidades…</option>}
                    {!loadingCities && cities.map(c => (
                      <option key={c.slug} value={c.slug} style={{ background: C.surface2 }}>
                        {c.name} / {c.state}
                      </option>
                    ))}
                  </select>
                  {cityError && <p id="city-error" style={{ color: C.negative, fontSize: '0.8125rem', marginTop: '0.25rem' }}>Não foi possível carregar as cidades: {cityError}</p>}
                </div>

                {/* Bairro */}
                <div>
                  <label style={labelStyle}>Bairro</label>
                  <select
                    value={neighborhood}
                    onChange={e => setNeighborhood(e.target.value)}
                    disabled={loadingHoods || !!hoodError}
                    required
                    style={selectStyle}
                    onFocus={handleFocus} onBlur={handleBlur}
                    aria-describedby={hoodError ? 'hood-error' : undefined}
                  >
                    {loadingHoods && <option>Carregando bairros…</option>}
                    {!loadingHoods && neighborhoods.map(n => (
                      <option key={n.name} value={n.name} style={{ background: C.surface2 }}>
                        {n.name}{n.medianPriceM2 !== null ? ` — R$\u00a0${(n.medianPriceM2 / 1000).toFixed(1).replace('.', ',')}k/m²` : ''}
                      </option>
                    ))}
                  </select>
                  {hoodError && <p id="hood-error" style={{ color: C.negative, fontSize: '0.8125rem', marginTop: '0.25rem' }}>Não foi possível carregar os bairros: {hoodError}</p>}
                </div>

                {/* Área + Tipo */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Área (m²)</label>
                    <input type="number" min="1" step="1" placeholder="Ex: 75" value={area} onChange={e => setArea(e.target.value)} required style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo</label>
                    <select value={propertyType} onChange={e => setPropertyType(e.target.value as PropertyType)} style={selectStyle} onFocus={handleFocus} onBlur={handleBlur}>
                      {PROPERTY_TYPES.map(([v, l]) => <option key={v} value={v} style={{ background: C.surface2 }}>{l}</option>)}
                    </select>
                  </div>
                </div>

                {/* Quartos / Banheiros / Vagas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  {([['Quartos', bedrooms, setBedrooms], ['Banheiros', bathrooms, setBathrooms], ['Vagas', parking, setParking]] as [string, string, React.Dispatch<React.SetStateAction<string>>][]).map(([l, v, s]) => (
                    <div key={l}>
                      <label style={labelStyle}>{l} <span style={{ opacity: 0.45, fontWeight: 400 }}>opt.</span></label>
                      <input type="number" min="0" step="1" placeholder="—" value={v} onChange={e => s(e.target.value)} style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                    </div>
                  ))}
                </div>

                {/* Turnstile */}
                {turnstileEnabled && (
                  <div style={{ marginTop: '0.25rem' }}>
                    <div className="cf-turnstile" data-sitekey={siteKey} data-callback="onTurnstileSuccess" />
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div role="alert" style={{ padding: '0.625rem 0.875rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '7px', color: C.negative, fontSize: '0.8125rem' }}>
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || loadingHoods || (turnstileEnabled && !turnstileToken)}
                  style={{ width: '100%', padding: '0.875rem', background: submitting ? C.accentDim : C.accent, color: submitting ? C.text2 : '#000', border: `1px solid ${submitting ? C.accentMid : C.accent}`, borderRadius: '9px', fontSize: '0.9375rem', fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', fontFamily: 'var(--font-body)', transition: 'opacity 0.15s', marginTop: '0.25rem' }}
                >
                  {submitting ? 'Calculando…' : 'Estimar valor →'}
                </button>
              </form>
            </div>

            {/* ── Right: result ── */}
            <div style={{ position: 'sticky', top: '76px' }}>
              {!result && !submitting && (
                <div style={{ minHeight: '400px', background: C.surface, border: `1px dashed ${C.border}`, borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem' }}>
                  <svg width="52" height="44" viewBox="0 0 52 44" fill="none">
                    <rect x="0"  y="30" width="12" height="14" rx="2" fill={C.border}/>
                    <rect x="20" y="20" width="12" height="24" rx="2" fill={C.border}/>
                    <rect x="40" y="10" width="12" height="34" rx="2" fill={C.border}/>
                    <polyline points="6,30 26,20 46,10" stroke={C.border} strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <p style={{ color: C.text3, fontSize: '0.875rem', textAlign: 'center', lineHeight: 1.55 }}>
                    Preencha o formulário<br />para ver a estimativa
                  </p>
                </div>
              )}

              {submitting && (
                <div style={{ minHeight: '400px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.125rem', padding: '2rem' }}>
                  <div style={{ width: '38px', height: '38px', border: `2.5px solid ${C.border}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <p style={{ color: C.text2, fontSize: '0.875rem' }}>Analisando dados de mercado…</p>
                </div>
              )}

              {result && !submitting && (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '1.75rem', animation: 'fadeInUp 0.45s ease both' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.375rem' }}>
                    <div>
                      <p style={{ fontSize: '0.5875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent, marginBottom: '4px' }}>
                        {result.neighborhood.name} · Estimativa
                      </p>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(1.875rem,4vw,2.625rem)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.08 }}>
                        {brl(result.estimate)}
                      </div>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div style={{ marginBottom: '1.375rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4375rem' }}>
                      <span style={{ fontSize: '0.6875rem', color: C.text2 }}>Intervalo de confiança 90%</span>
                    </div>
                    <div style={{ position: 'relative', height: '28px', background: C.surface2, borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: '8.5%', right: '8.5%', top: '30%', bottom: '30%', background: C.accentDim, borderRadius: '3px', border: `1px solid ${C.accentMid}` }} />
                      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '10%', bottom: '10%', width: '2px', background: C.accent, borderRadius: '1px' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4375rem' }}>
                      <span style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', color: C.text2 }}>{brl(result.confidenceLow)}</span>
                      <span style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', color: C.accent, fontWeight: 500 }}>{brl(result.estimate)}</span>
                      <span style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', color: C.text2 }}>{brl(result.confidenceHigh)}</span>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '1.25rem' }}>
                    {([
                      ['Preço/m² estimado', `${brl(Math.round(result.estimate / 85))}/m²`],
                      ['Mediana do bairro',  `${brl(result.neighborhood.medianPriceM2)}/m²`],
                    ] as [string,string][]).map(([lbl, val]) => (
                      <div key={lbl} style={{ padding: '0.75rem', background: C.surface2, borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.625rem', color: C.text2, marginBottom: '3px' }}>{lbl}</div>
                        <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: C.text }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  <Link
                    href="/resultados"
                    style={{ display: 'block', width: '100%', padding: '0.75rem', background: C.accentDim, border: `1px solid ${C.accentMid}`, color: C.accent, textDecoration: 'none', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600, borderRadius: '8px', transition: 'background 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.accentMid; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.accentDim; }}
                  >
                    Ver relatório completo →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
