'use client';

/**
 * Matrículas: upload de documentos (PDF/JPEG/PNG ≤ 10MB) por imóvel para o
 * R2 e listagem dos envios com status de verificação (manual). O botão
 * "Marcar verificada" registra a verificação na matrícula e seta
 * matricula_verificada no imóvel.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DataTable, type Column } from '@/components/auditoria/DataTable';
import { fmtDateTime } from '@/lib/auditoria-format';
import {
  MATRICULA_ALLOWED_MIMES,
  MATRICULA_MAX_SIZE_BYTES,
  validateMatriculaFile,
} from '@/lib/matricula';
import { tokens as C } from '@/lib/tokens';

interface ImovelOption {
  id: string;
  endereco: string | null;
  matriculaVerificada: boolean;
}

interface Matricula {
  id: string;
  imovelId: string;
  fileName: string;
  mime: string;
  size: number;
  checkedAt: string | null;
  createdAt: string;
}

/** Tamanho legível em pt-BR (ex.: "1,2 MB"). */
function fmtBytes(size: number): string {
  const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  if (size >= 1024 * 1024) return `${nf.format(size / (1024 * 1024))} MB`;
  if (size >= 1024) return `${nf.format(size / 1024)} KB`;
  return `${nf.format(size)} B`;
}

const selectStyle: React.CSSProperties = {
  padding: '0.4375rem 0.75rem',
  background: C.surface3,
  border: `1px solid ${C.border}`,
  borderRadius: '7px',
  color: C.text,
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-body)',
  maxWidth: '320px',
};

function StatusChip({ verificada }: { verificada: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '9px',
        fontSize: '0.625rem',
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        background: verificada ? 'rgba(74,222,128,0.12)' : 'rgba(250,204,21,0.12)',
        border: `1px solid ${verificada ? 'rgba(74,222,128,0.3)' : 'rgba(250,204,21,0.3)'}`,
        color: verificada ? C.positive : C.amber,
      }}
    >
      {verificada ? 'verificada' : 'pendente'}
    </span>
  );
}

export default function MatriculasPage() {
  const [imoveis, setImoveis] = useState<ImovelOption[]>([]);
  const [rows, setRows] = useState<Matricula[]>([]);
  const [imovelId, setImovelId] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadImoveis = useCallback(async () => {
    try {
      const res = await fetch('/api/auditoria/imoveis');
      if (!res.ok) return;
      setImoveis(((await res.json()) as { imoveis: ImovelOption[] }).imoveis);
    } catch {
      // silencioso — o select fica vazio.
    }
  }, []);

  const loadMatriculas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auditoria/matricula');
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? 'Falha ao carregar matrículas.');
        return;
      }
      setRows(((await res.json()) as { matriculas: Matricula[] }).matriculas);
      setError(null);
    } catch {
      setError('Falha de rede ao carregar matrículas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadImoveis();
    void loadMatriculas();
  }, [loadImoveis, loadMatriculas]);

  const enderecoDe = useCallback(
    (id: string) => imoveis.find((i) => i.id === id)?.endereco ?? '—',
    [imoveis],
  );

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    setSuccess(null);
    if (!imovelId) {
      setError('Selecione um imóvel.');
      return;
    }
    if (!file) {
      setError('Selecione um arquivo (PDF, JPEG ou PNG).');
      return;
    }
    // Validação no client espelha a do servidor (feedback imediato).
    const validation = validateMatriculaFile(file.type, file.size);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('imovelId', imovelId);
      const res = await fetch('/api/auditoria/matricula/upload', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? 'Falha ao enviar o arquivo.');
        return;
      }
      setSuccess('Documento enviado com sucesso.');
      if (fileRef.current) fileRef.current.value = '';
      await loadMatriculas();
    } catch {
      setError('Falha de rede ao enviar o arquivo.');
    } finally {
      setUploading(false);
    }
  }

  async function handleCheck(id: string) {
    setCheckingId(id);
    try {
      const res = await fetch('/api/auditoria/matricula/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await Promise.all([loadMatriculas(), loadImoveis()]);
      }
    } finally {
      setCheckingId(null);
    }
  }

  const columns: Column<Matricula>[] = [
    {
      key: 'arquivo',
      header: 'Arquivo',
      width: '1.5fr',
      render: (m) => (
        <span
          style={{
            fontWeight: 500,
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {m.fileName}
        </span>
      ),
    },
    {
      key: 'imovel',
      header: 'Imóvel',
      width: '1.5fr',
      render: (m) => (
        <span
          style={{
            color: C.text2,
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {enderecoDe(m.imovelId)}
        </span>
      ),
    },
    {
      key: 'tamanho',
      header: 'Tamanho',
      width: '90px',
      render: (m) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: C.text3 }}>
          {fmtBytes(m.size)}
        </span>
      ),
    },
    {
      key: 'enviada',
      header: 'Enviada em',
      width: '110px',
      render: (m) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: C.text3 }}>
          {fmtDateTime(m.createdAt)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (m) => <StatusChip verificada={m.checkedAt !== null} />,
    },
    {
      key: 'acao',
      header: 'Ação',
      width: '140px',
      render: (m) =>
        m.checkedAt !== null ? (
          <span style={{ fontSize: '0.6875rem', color: C.positive, fontFamily: 'var(--font-mono)' }}>
            ✓ verificada
          </span>
        ) : (
          <button
            type="button"
            disabled={checkingId === m.id}
            onClick={() => void handleCheck(m.id)}
            style={{
              padding: '0.3125rem 0.75rem',
              background: C.accentDim,
              border: `1px solid ${C.accentMid}`,
              borderRadius: '6px',
              color: C.accent,
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              cursor: checkingId === m.id ? 'wait' : 'pointer',
            }}
          >
            {checkingId === m.id ? '…' : 'Marcar verificada'}
          </button>
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
        Matrículas
      </h1>

      {/* Formulário de upload */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: '14px',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <select value={imovelId} onChange={(e) => setImovelId(e.target.value)} style={selectStyle}>
          <option value="">Selecione o imóvel…</option>
          {imoveis.map((i) => (
            <option key={i.id} value={i.id}>
              {(i.endereco ?? i.id) + (i.matriculaVerificada ? ' ✓' : '')}
            </option>
          ))}
        </select>

        <input
          ref={fileRef}
          type="file"
          accept={MATRICULA_ALLOWED_MIMES.join(',')}
          style={{ color: C.text2, fontSize: '0.8125rem', fontFamily: 'var(--font-body)' }}
        />

        <button
          type="button"
          disabled={uploading}
          onClick={() => void handleUpload()}
          style={{
            padding: '0.4375rem 1rem',
            background: C.accentDim,
            border: `1px solid ${C.accentMid}`,
            borderRadius: '7px',
            color: C.accent,
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            cursor: uploading ? 'wait' : 'pointer',
          }}
        >
          {uploading ? 'Enviando…' : 'Enviar documento'}
        </button>

        <span style={{ fontSize: '0.6875rem', color: C.text3, fontFamily: 'var(--font-mono)' }}>
          PDF, JPEG ou PNG · máx. {Math.floor(MATRICULA_MAX_SIZE_BYTES / (1024 * 1024))}MB
        </span>
      </div>

      {error && <p style={{ color: C.negative, fontSize: '0.8125rem', margin: 0 }}>{error}</p>}
      {success && <p style={{ color: C.positive, fontSize: '0.8125rem', margin: 0 }}>{success}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(m) => m.id}
        empty={loading ? 'Carregando…' : 'Nenhuma matrícula enviada ainda.'}
      />
    </div>
  );
}
