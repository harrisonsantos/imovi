'use client';

/**
 * Visão geral da auditoria: KPIs (leads, negócios, anomalias abertas,
 * corretores ativos) + feed das últimas anomalias não resolvidas com ação de
 * resolver inline.
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/auditoria/Card';
import { SeverityChip } from '@/components/auditoria/SeverityChip';
import { fetchAuditoria } from '@/lib/auditoria-fetch';
import { anomaliaTipoLabel, fmtDateTime } from '@/lib/auditoria-format';
import { tokens as C } from '@/lib/tokens';

interface Metrics {
  leads: { total: number; hoje: number };
  negocios: { total: number; fechadosNoMes: number };
  anomalias: { naoResolvidas: { alta: number; media: number; baixa: number; total: number } };
  corretores: { ativos: number };
}

interface Anomalia {
  id: string;
  tipo: string;
  severidade: string;
  descricao: string | null;
  createdAt: string;
}

export default function AuditoriaOverviewPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [anomalias, setAnomalias] = useState<Anomalia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [mRes, aRes] = await Promise.all([
        fetchAuditoria('/api/auditoria/metrics'),
        fetchAuditoria('/api/auditoria/anomalias?resolvida=false&limit=8'),
      ]);
      if (!mRes.ok || !aRes.ok) {
        const body = (await (mRes.ok ? aRes : mRes).json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(body?.message ?? 'Falha ao carregar o painel.');
        return;
      }
      setMetrics((await mRes.json()) as Metrics);
      setAnomalias(((await aRes.json()) as { anomalias: Anomalia[] }).anomalias);
      setError(null);
    } catch {
      setError('Falha de rede ao carregar o painel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleResolve(id: string) {
    setResolvingId(id);
    try {
      const res = await fetchAuditoria('/api/auditoria/anomalias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) await load();
    } finally {
      setResolvingId(null);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '1.75rem' }}>
        <p style={{ color: C.text2, fontSize: '0.875rem' }}>Carregando…</p>
      </div>
    );
  }

  const abertas = metrics?.anomalias.naoResolvidas;

  return (
    <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && <p style={{ color: C.negative, fontSize: '0.8125rem', margin: 0 }}>{error}</p>}

      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }}>
          <Card
            label="Leads"
            value={metrics.leads.total}
            sub={`${metrics.leads.hoje} hoje`}
          />
          <Card
            label="Negócios"
            value={metrics.negocios.total}
            sub={`${metrics.negocios.fechadosNoMes} fechados no mês`}
          />
          <Card
            label="Anomalias abertas"
            value={abertas?.total ?? 0}
            valueColor={(abertas?.total ?? 0) > 0 ? C.negative : C.text}
            sub={`${abertas?.alta ?? 0} alta · ${abertas?.media ?? 0} média · ${abertas?.baixa ?? 0} baixa`}
          />
          <Card label="Corretores ativos" value={metrics.corretores.ativos} sub="na organização" />
        </div>
      )}

      {/* Feed de anomalias abertas */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: '14px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <p
              style={{
                fontSize: '0.5875rem',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: C.accent,
                marginBottom: '2px',
              }}
            >
              Atenção
            </p>
            <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: C.text, margin: 0 }}>
              Últimas anomalias abertas
            </p>
          </div>
          <Link
            href="/auditoria/anomalias"
            style={{
              fontSize: '0.8125rem',
              color: C.accent,
              textDecoration: 'none',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Ver todas →
          </Link>
        </div>

        {anomalias.length === 0 ? (
          <div style={{ padding: '2.5rem 1.25rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.875rem', color: C.text2, margin: 0 }}>
              Nenhuma anomalia aberta. Tudo em ordem.
            </p>
          </div>
        ) : (
          anomalias.map((a, i) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.875rem 1.25rem',
                borderBottom: i < anomalias.length - 1 ? `1px solid ${C.border}` : 'none',
              }}
            >
              <SeverityChip severidade={a.severidade} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: C.text }}>
                  {anomaliaTipoLabel(a.tipo)}
                </div>
                {a.descricao && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: C.text2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.descricao}
                  </div>
                )}
              </div>
              <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: C.text3 }}>
                {fmtDateTime(a.createdAt)}
              </span>
              <button
                type="button"
                disabled={resolvingId === a.id}
                onClick={() => void handleResolve(a.id)}
                style={{
                  padding: '0.3125rem 0.75rem',
                  background: C.accentDim,
                  border: `1px solid ${C.accentMid}`,
                  borderRadius: '6px',
                  color: C.accent,
                  fontSize: '0.6875rem',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  cursor: resolvingId === a.id ? 'wait' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {resolvingId === a.id ? 'Resolvendo…' : 'Resolver'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
