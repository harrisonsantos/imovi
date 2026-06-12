'use client';

/**
 * Lista de negócios/vendas: corretor, imóvel (endereço), valor de venda em
 * BRL, data de fechamento e status. Paginação por offset + exportação CSV.
 */

import { useCallback, useEffect, useState } from 'react';
import { DataTable, type Column } from '@/components/auditoria/DataTable';
import { ExportCsvButton } from '@/components/auditoria/ExportCsvButton';
import { Paginator } from '@/components/auditoria/Paginator';
import { fmtBrl, fmtDate } from '@/lib/auditoria-format';
import { tokens as C } from '@/lib/tokens';

const LIMIT = 20;

interface Negocio {
  id: string;
  vistaId: string;
  corretorId: string | null;
  endereco: string | null;
  valorVenda: string | null;
  dataFechamento: string | null;
  status: string | null;
}

interface Corretor {
  id: string;
  nome: string;
}

export default function NegociosPage() {
  const [rows, setRows] = useState<Negocio[]>([]);
  const [corretores, setCorretores] = useState<Record<string, string>>({});
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mapa corretorId → nome, carregado uma vez.
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
      const res = await fetch(`/api/auditoria/negocios?limit=${LIMIT}&offset=${offset}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? 'Falha ao carregar negócios.');
        return;
      }
      setRows(((await res.json()) as { negocios: Negocio[] }).negocios);
      setError(null);
    } catch {
      setError('Falha de rede ao carregar negócios.');
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const corretorNome = (id: string | null) => (id ? (corretores[id] ?? '—') : '—');

  const columns: Column<Negocio>[] = [
    {
      key: 'corretor',
      header: 'Corretor',
      width: '1fr',
      render: (n) => <span style={{ fontWeight: 500 }}>{corretorNome(n.corretorId)}</span>,
    },
    {
      key: 'imovel',
      header: 'Imóvel',
      width: '1.6fr',
      render: (n) => (
        <span
          style={{
            color: C.text2,
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {n.endereco ?? '—'}
        </span>
      ),
    },
    {
      key: 'valor',
      header: 'Valor venda',
      width: '120px',
      render: (n) => (
        <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtBrl(n.valorVenda)}</span>
      ),
    },
    {
      key: 'fechamento',
      header: 'Fechamento',
      width: '100px',
      render: (n) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: C.text2 }}>
          {fmtDate(n.dataFechamento)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (n) =>
        n.status ? (
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: '6px',
              background: C.surface2,
              border: `1px solid ${C.border}`,
              color: C.text2,
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {n.status}
          </span>
        ) : (
          <span style={{ color: C.text3 }}>—</span>
        ),
    },
  ];

  return (
    <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
          Negócios
        </h1>
        <ExportCsvButton
          filename="negocios"
          headers={['Corretor', 'Imóvel', 'Valor venda', 'Data fechamento', 'Status']}
          rows={rows.map((n) => [
            corretorNome(n.corretorId),
            n.endereco,
            n.valorVenda,
            fmtDate(n.dataFechamento),
            n.status,
          ])}
        />
      </div>

      {error && <p style={{ color: C.negative, fontSize: '0.8125rem', margin: 0 }}>{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(n) => n.id}
        empty={loading ? 'Carregando…' : 'Nenhum negócio sincronizado ainda.'}
      />

      <Paginator offset={offset} limit={LIMIT} count={rows.length} onChange={setOffset} />
    </div>
  );
}
