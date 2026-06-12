'use client';

/**
 * Lista de leads: nome, origem, status (chip), corretor e última atualização.
 * Filtro por status, paginação por offset e exportação CSV.
 */

import { useCallback, useEffect, useState } from 'react';
import { DataTable, type Column } from '@/components/auditoria/DataTable';
import { ExportCsvButton } from '@/components/auditoria/ExportCsvButton';
import { Paginator } from '@/components/auditoria/Paginator';
import { fmtDateTime } from '@/lib/auditoria-format';
import { tokens as C } from '@/lib/tokens';

const LIMIT = 20;

const STATUS_OPTIONS = ['novo', 'contatado', 'proposta', 'ganho', 'perdido'] as const;

interface Lead {
  id: string;
  nome: string | null;
  origem: string | null;
  status: string | null;
  corretorId: string | null;
  updatedAt: string;
}

interface Corretor {
  id: string;
  nome: string;
}

/** Chip de status do lead: ganho (verde), perdido (vermelho), demais (azul). */
function StatusChip({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: C.text3 }}>—</span>;
  const color =
    status === 'ganho' ? C.positive : status === 'perdido' ? C.negative : C.blue;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '6px',
        background: 'transparent',
        border: `1px solid ${color}40`,
        color,
        fontSize: '0.6875rem',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {status}
    </span>
  );
}

export default function LeadsPage() {
  const [rows, setRows] = useState<Lead[]>([]);
  const [corretores, setCorretores] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auditoria/corretores');
        if (!res.ok || !active) return;
        const data = (await res.json()) as { corretores: Corretor[] };
        setCorretores(Object.fromEntries(data.corretores.map((c) => [c.id, c.nome])));
      } catch {
        // sem o mapa exibimos '—' na coluna corretor.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (status) params.set('status', status);
      const res = await fetch(`/api/auditoria/leads?${params}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? 'Falha ao carregar leads.');
        return;
      }
      setRows(((await res.json()) as { leads: Lead[] }).leads);
      setError(null);
    } catch {
      setError('Falha de rede ao carregar leads.');
    } finally {
      setLoading(false);
    }
  }, [status, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const corretorNome = (id: string | null) => (id ? (corretores[id] ?? '—') : '—');

  const columns: Column<Lead>[] = [
    {
      key: 'nome',
      header: 'Nome',
      width: '1.4fr',
      render: (l) => <span style={{ fontWeight: 500 }}>{l.nome ?? '—'}</span>,
    },
    {
      key: 'origem',
      header: 'Origem',
      width: '1fr',
      render: (l) => <span style={{ color: C.text2 }}>{l.origem ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (l) => <StatusChip status={l.status} />,
    },
    {
      key: 'corretor',
      header: 'Corretor',
      width: '1fr',
      render: (l) => <span style={{ color: C.text2 }}>{corretorNome(l.corretorId)}</span>,
    },
    {
      key: 'atualizado',
      header: 'Atualizado em',
      width: '110px',
      render: (l) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: C.text3 }}>
          {fmtDateTime(l.updatedAt)}
        </span>
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
          Leads
        </h1>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOffset(0);
          }}
          style={{
            padding: '0.4375rem 0.75rem',
            background: C.surface3,
            border: `1px solid ${C.border}`,
            borderRadius: '7px',
            color: C.text,
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-body)',
          }}
        >
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <ExportCsvButton
          filename="leads"
          headers={['Nome', 'Origem', 'Status', 'Corretor', 'Atualizado em']}
          rows={rows.map((l) => [
            l.nome,
            l.origem,
            l.status,
            corretorNome(l.corretorId),
            fmtDateTime(l.updatedAt),
          ])}
        />
      </div>

      {error && <p style={{ color: C.negative, fontSize: '0.8125rem', margin: 0 }}>{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(l) => l.id}
        empty={loading ? 'Carregando…' : 'Nenhum lead com os filtros atuais.'}
      />

      <Paginator offset={offset} limit={LIMIT} count={rows.length} onChange={setOffset} />
    </div>
  );
}
