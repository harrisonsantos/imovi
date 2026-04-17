'use client';

/**
 * Formulário de estimativa — client component.
 *
 * Estética clean, sem libs externas. Estilos inline para simplicidade no MVP
 * (migrar pra CSS modules quando a UI crescer).
 */

import Script from 'next/script';
import { useEffect, useState, type FormEvent } from 'react';

interface EstimateFormProps {
  /** Cloudflare Turnstile site key. Se ausente (ex.: dev local), widget não é renderizado. */
  siteKey?: string | undefined;
}

// Callback global exposto pro script do Turnstile chamar após sucesso.
declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void;
  }
}

type PropertyType = 'apartment' | 'house' | 'commercial' | 'land';

interface Neighborhood {
  name: string;
  medianPriceM2: number | null;
}

interface EstimateResponse {
  estimate: number;
  confidenceLow: number;
  confidenceHigh: number;
  modelVersion: string;
  featuresUsed: Record<string, number>;
  neighborhood: { name: string; medianPriceM2: number };
}

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: 'Apartamento',
  house: 'Casa',
  commercial: 'Comercial',
  land: 'Terreno',
};

const brl = (n: number): string =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: '0.5rem',
  fontSize: '1rem',
  fontFamily: 'inherit',
  color: '#0f172a',
  background: '#fff',
  outlineOffset: '2px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#334155',
  marginBottom: '0.375rem',
};

const fieldWrap: React.CSSProperties = { marginBottom: '1rem' };

export default function EstimateForm({ siteKey }: EstimateFormProps = {}) {
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [loadingHoods, setLoadingHoods] = useState(true);
  const [hoodError, setHoodError] = useState<string | null>(null);

  const [neighborhood, setNeighborhood] = useState('');
  const [area, setArea] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [parking, setParking] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EstimateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Token retornado pelo widget Turnstile. Só obrigatório quando siteKey está presente.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileEnabled = Boolean(siteKey);

  // Expõe callback global que o script do Turnstile invoca (via data-callback).
  useEffect(() => {
    if (!turnstileEnabled) return;
    window.onTurnstileSuccess = (token: string) => setTurnstileToken(token);
    return () => {
      delete window.onTurnstileSuccess;
    };
  }, [turnstileEnabled]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/neighborhoods?city=Curitiba&state=PR');
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
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setResult(null);

    const areaNum = Number(area);
    if (!Number.isFinite(areaNum) || areaNum <= 0) {
      setError('Informe uma área válida em m².');
      return;
    }
    if (!neighborhood) {
      setError('Selecione um bairro.');
      return;
    }

    const payload: Record<string, unknown> = {
      city: 'Curitiba',
      state: 'PR',
      neighborhood,
      area: areaNum,
      propertyType,
    };
    if (bedrooms) payload.bedrooms = Number(bedrooms);
    if (bathrooms) payload.bathrooms = Number(bathrooms);
    if (parking) payload.parking = Number(parking);
    if (turnstileToken) payload.turnstileToken = turnstileToken;

    setSubmitting(true);
    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as EstimateResponse | { error: string; message: string };
      if (!res.ok) {
        setError('message' in data ? data.message : 'Erro desconhecido.');
        return;
      }
      setResult(data as EstimateResponse);
    } catch (err) {
      setError(`Falha de rede: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {turnstileEnabled && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          async
          defer
        />
      )}
    <section
      aria-labelledby="form-title"
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.875rem',
        padding: '1.75rem',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
      }}
    >
      <h2
        id="form-title"
        style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 1.25rem' }}
      >
        Dados do imóvel
      </h2>

      <form onSubmit={onSubmit} noValidate>
        <div style={fieldWrap}>
          <label htmlFor="neighborhood" style={labelStyle}>
            Bairro
          </label>
          <select
            id="neighborhood"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            disabled={loadingHoods || !!hoodError}
            required
            style={inputStyle}
            aria-describedby={hoodError ? 'hood-error' : undefined}
          >
            {loadingHoods && <option>Carregando bairros…</option>}
            {!loadingHoods &&
              neighborhoods.map((n) => (
                <option key={n.name} value={n.name}>
                  {n.name}
                  {n.medianPriceM2 !== null ? ` — ${brl(n.medianPriceM2)}/m²` : ''}
                </option>
              ))}
          </select>
          {hoodError && (
            <p id="hood-error" style={{ color: '#b91c1c', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
              Não foi possível carregar os bairros: {hoodError}
            </p>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={fieldWrap}>
            <label htmlFor="area" style={labelStyle}>
              Área (m²)
            </label>
            <input
              id="area"
              type="number"
              inputMode="decimal"
              min="1"
              step="1"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              required
              style={inputStyle}
              placeholder="Ex: 75"
            />
          </div>

          <div style={fieldWrap}>
            <label htmlFor="propertyType" style={labelStyle}>
              Tipo
            </label>
            <select
              id="propertyType"
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value as PropertyType)}
              style={inputStyle}
            >
              {(Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]).map((t) => (
                <option key={t} value={t}>
                  {PROPERTY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div style={fieldWrap}>
            <label htmlFor="bedrooms" style={labelStyle}>
              Quartos
            </label>
            <input
              id="bedrooms"
              type="number"
              min="0"
              step="1"
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              style={inputStyle}
              placeholder="Opcional"
            />
          </div>
          <div style={fieldWrap}>
            <label htmlFor="bathrooms" style={labelStyle}>
              Banheiros
            </label>
            <input
              id="bathrooms"
              type="number"
              min="0"
              step="1"
              value={bathrooms}
              onChange={(e) => setBathrooms(e.target.value)}
              style={inputStyle}
              placeholder="Opcional"
            />
          </div>
          <div style={fieldWrap}>
            <label htmlFor="parking" style={labelStyle}>
              Vagas
            </label>
            <input
              id="parking"
              type="number"
              min="0"
              step="1"
              value={parking}
              onChange={(e) => setParking(e.target.value)}
              style={inputStyle}
              placeholder="Opcional"
            />
          </div>
        </div>

        {turnstileEnabled && (
          <div style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
            <div
              className="cf-turnstile"
              data-sitekey={siteKey}
              data-callback="onTurnstileSuccess"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || loadingHoods || (turnstileEnabled && !turnstileToken)}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            background: submitting ? '#93c5fd' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            marginTop: '0.5rem',
            fontFamily: 'inherit',
          }}
        >
          {submitting ? 'Estimando…' : 'Estimar'}
        </button>
      </form>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: '1.25rem',
            padding: '0.875rem 1rem',
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            fontSize: '0.9375rem',
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '0.75rem',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#0369a1',
              fontWeight: 600,
            }}
          >
            Estimativa
          </p>
          <p
            style={{
              margin: '0.25rem 0 0.5rem',
              fontSize: '2rem',
              fontWeight: 700,
              color: '#0c4a6e',
              letterSpacing: '-0.02em',
            }}
          >
            {brl(result.estimate)}
          </p>
          <p style={{ margin: 0, color: '#0369a1' }}>
            Intervalo: <strong>{brl(result.confidenceLow)}</strong> a{' '}
            <strong>{brl(result.confidenceHigh)}</strong>
          </p>
          <p
            style={{
              marginTop: '0.75rem',
              fontSize: '0.8125rem',
              color: '#475569',
              lineHeight: 1.5,
            }}
          >
            Bairro: {result.neighborhood.name} · Mediana:{' '}
            {brl(result.neighborhood.medianPriceM2)}/m² · Modelo:{' '}
            <code>{result.modelVersion}</code>
          </p>
          <p
            style={{
              marginTop: '0.75rem',
              fontSize: '0.75rem',
              color: '#64748b',
              fontStyle: 'italic',
            }}
          >
            Estimativa heurística. Modelo v0 baseado em dados agregados. Precisão ±30%.
          </p>
        </div>
      )}
    </section>
    </>
  );
}
