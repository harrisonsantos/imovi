'use client';

/**
 * Lista de anomalias com filtros (tipo, resolvida), paginação por offset,
 * resolução inline e exportação CSV (linhas carregadas, padrão Excel pt-BR).
 */

import { useCallback, useEffect, useState } from 'react';
import { DataTable, type Column } from '@/components/auditoria/DataTable';
import { ExportCsvButton } from '@/components/auditoria/ExportCsvButton';
import { Paginator } from '@/components/auditoria/Paginator';
import { SeverityChip } from '@/components/auditoria/SeverityChip';
import { ANOMALIA_TIPO_LABELS, anomaliaTipoLabel, fmtDateTime } from '@/lib/auditoria-format';
import { tokens as C } from '@/lib/tokens';

const LIMIT = 20;

interface Anomalia {
  id: string;
  tipo: string;
  severidade: string;
  descricao: string | null;
  entidadeTipo: string | null;
  resolvida: boolean;
  resolvidaEm: string | null;
  createdAt: string;
}

type ResolvidaFilter = 'abertas' | 'resolvidas' | 'todas';

const selectStyle: React.CSSProperties = {
  padding: '0.4375rem 0.75rem',
  background: C.surface3,
  border: `1px solid ${C.border}`,
  borderRadius: '7px',
  color: C.text,
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-body)',
};

export default function AnomaliasPage() {
  const [rows, setRows] = useState<Anomalia[]>([]);
  const [tipo, setTipo] = useState('');
  const [resolvida, setResolvida] = useState<ResolvidaFilter>('abertas');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (tipo) params.set('tipo', tipo);
      if (resolvida !== 'todas') params.set('resolvida', String(resolvida === 'resolvidas'));
      const res = await fetch(`/api/auditoria/anomalias?${params}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? 'Falha ao carregar anomalias.');
        return;
      }
      setRows(((await res.json()) as { anomalias: Anomalia[] }).anomalias);
      setError(null);
    } catch {
      setError('Falha de rede ao carregar anomalias.');
    } finally {
      setLoading(false);
    }
  }, [tipo, resolvida, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleResolve(id: string) {
    setResolvingId(id);
    try {
      const res = await fetch('/api/auditoria/anomalias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) await load();
    } finally {
      setResolvingId(null);
    }
  }

  const columns: Column<Anomalia>[] = [
    {
      key: 'severidade',
      header: 'Severidade',
      width: '90px',
      render: (a) => <SeverityChip severidade={a.severidade} />,
    },
    {
      key: 'tipo',
      header: 'Tipo',
      width: '1.2fr',
      render: (a) => <span style={{ fontWeight: 500 }}>{anomaliaTipoLabel(a.tipo)}</span>,
    },
    {
      key: 'descricao',
      header: 'Descrição',
      width: '2fr',
      render: (a) => (
        <span
          style={{
            color: C.text2,
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {a.descricao ?? '—'}
        </span>
      ),
    },
    {
      key: 'criada',
      header: 'Detectada em',
      width: '110px',
      render: (a) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: C.text3 }}>
          {fmtDateTime(a.createdAt)}
        </span>
      ),
    },
    {
      key: 'acao',
      header: 'Ação',
      width: '110px',
      render: (a) =>
        a.resolvida ? (
          <span style={{ fontSize: '0.6875rem', color: C.positive, fontFamily: 'var(--font-mono)' }}>
            ✓ resolvida
          </span>
        ) : (
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
            }}
          >
            {resolvingId === a.id ? '…' : 'Resolver'}
          </button>
        ),
    },
  ];

  return (
    <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '1.375rem',
            letterSpacing: '-0.03em',
            color: C.text,
            margin: 0,
            marginRight: 'auto',
          }}
        >
          Anomalias
        </h1>

        {/* Toggle abertas/resolvidas/todas */}
        <div style={{ display: 'flex', gap: '2px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '2px' }}>
          {(['abertas', 'resolvidas', 'todas'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                setResolvida(opt);
                setOffset(0);
              }}
              style={{
                padding: '0.3125rem 0.75rem',
                background: resolvida === opt ? C.accentDim : 'transparent',
                border: `1px solid ${resolvida === opt ? C.accentMid : 'transparent'}`,
                borderRadius: '6px',
                color: resolvida === opt ? C.accent : C.text2,
                fontSize: '0.75rem',
                fontFamily: 'var(--font-body)',
                fontWeight: resolvida === opt ? 600 : 400,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {opt}
            </button>
          ))}
        </div>

        <select
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value);
            setOffset(0);
          }}
          style={selectStyle}
        >
          <option value="">Todos os tipos</option>
          {Object.entries(ANOMALIA_TIPO_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <ExportCsvButton
          filename="anomalias"
          headers={['Severidade', 'Tipo', 'Descrição', 'Resolvida', 'Detectada em', 'Resolvida em']}
          rows={rows.map((a) => [
            a.severidade,
            anomaliaTipoLabel(a.tipo),
            a.descricao,
            a.resolvida ? 'sim' : 'não',
            fmtDateTime(a.createdAt),
            a.resolvidaEm ? fmtDateTime(a.resolvidaEm) : '',
          ])}
        />
      </div>

      {error && <p style={{ color: C.negative, fontSize: '0.8125rem', margin: 0 }}>{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(a) => a.id}
        empty={loading ? 'Carregando…' : 'Nenhuma anomalia com os filtros atuais.'}
      />

      <Paginator offset={offset} limit={LIMIT} count={rows.length} onChange={setOffset} />
    </div>
  );
}
