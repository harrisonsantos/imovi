'use client';

/**
 * Lista de corretores da organização: nome, CRECI, e-mail e situação.
 */

import { useEffect, useState } from 'react';
import { DataTable, type Column } from '@/components/auditoria/DataTable';
import { fetchAuditoria } from '@/lib/auditoria-fetch';
import { tokens as C } from '@/lib/tokens';

interface Corretor {
  id: string;
  nome: string;
  creci: string | null;
  email: string | null;
  ativo: boolean | null;
}

export default function CorretoresPage() {
  const [rows, setRows] = useState<Corretor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchAuditoria('/api/auditoria/corretores');
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          if (active) setError(body?.message ?? 'Falha ao carregar corretores.');
          return;
        }
        const data = (await res.json()) as { corretores: Corretor[] };
        if (active) setRows(data.corretores);
      } catch {
        if (active) setError('Falha de rede ao carregar corretores.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const columns: Column<Corretor>[] = [
    {
      key: 'nome',
      header: 'Nome',
      width: '1.4fr',
      render: (c) => <span style={{ fontWeight: 500 }}>{c.nome}</span>,
    },
    {
      key: 'creci',
      header: 'CRECI',
      width: '120px',
      render: (c) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: C.text2 }}>
          {c.creci ?? '—'}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'E-mail',
      width: '1.4fr',
      render: (c) => <span style={{ color: C.text2 }}>{c.email ?? '—'}</span>,
    },
    {
      key: 'ativo',
      header: 'Situação',
      width: '90px',
      render: (c) => (
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '6px',
            background: c.ativo ? C.accentDim : C.surface2,
            border: `1px solid ${c.ativo ? C.accentMid : C.border}`,
            color: c.ativo ? C.accent : C.text3,
            fontSize: '0.6875rem',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {c.ativo ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: '1.375rem',
          letterSpacing: '-0.03em',
          color: C.text,
          margin: 0,
        }}
      >
        Corretores
      </h1>

      {error && <p style={{ color: C.negative, fontSize: '0.8125rem', margin: 0 }}>{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(c) => c.id}
        empty={loading ? 'Carregando…' : 'Nenhum corretor sincronizado ainda.'}
      />
    </div>
  );
}
