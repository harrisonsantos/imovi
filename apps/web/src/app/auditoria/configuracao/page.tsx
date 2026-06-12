'use client';

/**
 * Configuração do módulo de auditoria — integração Vista CRM.
 *
 * Carrega/salva via /api/auditoria/config. A API key nunca volta do servidor:
 * o input mostra o placeholder "••• configurada" quando hasApiKey é true e só
 * envia a key quando o usuário digita uma nova. Após salvar, exibe a URL do
 * webhook (com token) e botão de copiar.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchAuditoria } from '@/lib/auditoria-fetch';
import { tokens as C } from '@/lib/tokens';

interface ConfigResponse {
  vistaApiUrl: string | null;
  hasApiKey: boolean;
  reportEmails: string[];
  avmDeviationPct: number;
  webhookUrl: string | null;
}

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
const labelStyle: React.CSSProperties = {
  display:      'block',
  fontSize:     '0.75rem',
  fontWeight:   500,
  color:        C.text2,
  marginBottom: '0.3125rem',
};
const hintStyle: React.CSSProperties = {
  color:     C.text2,
  fontSize:  '0.6875rem',
  marginTop: '0.25rem',
};

export default function ConfiguracaoPage() {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [saved, setSaved]       = useState(false);
  const [copied, setCopied]     = useState(false);

  const [vistaApiUrl, setVistaApiUrl]         = useState('');
  const [vistaApiKey, setVistaApiKey]         = useState('');
  const [hasApiKey, setHasApiKey]             = useState(false);
  const [reportEmails, setReportEmails]       = useState('');
  const [avmDeviationPct, setAvmDeviationPct] = useState(25);
  const [webhookUrl, setWebhookUrl]           = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchAuditoria('/api/auditoria/config');
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          if (active) setError(body?.message ?? 'Falha ao carregar configuração.');
          return;
        }
        const data = (await res.json()) as ConfigResponse;
        if (!active) return;
        setVistaApiUrl(data.vistaApiUrl ?? '');
        setHasApiKey(data.hasApiKey);
        setReportEmails(data.reportEmails.join(', '));
        setAvmDeviationPct(data.avmDeviationPct);
        setWebhookUrl(data.webhookUrl);
      } catch {
        if (active) setError('Falha de rede ao carregar configuração.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const emails = reportEmails
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload: Record<string, unknown> = {
        reportEmails: emails,
        avmDeviationPct,
      };
      if (vistaApiUrl.trim()) payload.vistaApiUrl = vistaApiUrl.trim();
      // Só envia a key se o usuário digitou uma nova (nunca reenviamos a atual).
      if (vistaApiKey.trim()) payload.vistaApiKey = vistaApiKey.trim();

      const res = await fetchAuditoria('/api/auditoria/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? 'Falha ao salvar configuração.');
        return;
      }
      const data = (await res.json()) as ConfigResponse;
      setHasApiKey(data.hasApiKey);
      setWebhookUrl(data.webhookUrl);
      setVistaApiKey('');
      setSaved(true);
    } catch {
      setError('Falha de rede. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível — usuário pode selecionar manualmente.
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: C.bg,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ marginBottom: '2rem' }}>
          <Link
            href="/auditoria"
            style={{ color: C.text2, fontSize: '0.8125rem', textDecoration: 'none' }}
          >
            ← Voltar à auditoria
          </Link>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '1.5rem',
              color: C.text,
              margin: '0.75rem 0 0.25rem',
            }}
          >
            Configuração da integração Vista
          </h1>
          <p style={{ color: C.text2, fontSize: '0.875rem', margin: 0 }}>
            Conecte seu Vista CRM para auditoria contínua de imóveis, leads e vendas.
          </p>
        </div>

        {loading ? (
          <p style={{ color: C.text2, fontSize: '0.875rem' }}>Carregando…</p>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div>
              <label htmlFor="vistaApiUrl" style={labelStyle}>Vista API URL</label>
              <input
                id="vistaApiUrl"
                type="url"
                placeholder="http://sandbox-rest.vistahost.com.br"
                value={vistaApiUrl}
                onChange={(e) => setVistaApiUrl(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="vistaApiKey" style={labelStyle}>Vista API key</label>
              <input
                id="vistaApiKey"
                type="password"
                autoComplete="off"
                placeholder={hasApiKey ? '••• configurada' : 'Cole a API key do Vista'}
                value={vistaApiKey}
                onChange={(e) => setVistaApiKey(e.target.value)}
                style={inputStyle}
              />
              <p style={hintStyle}>
                Armazenada cifrada. Deixe em branco para manter a key atual.
              </p>
            </div>

            <div>
              <label htmlFor="reportEmails" style={labelStyle}>
                E-mails do relatório (separados por vírgula)
              </label>
              <input
                id="reportEmails"
                type="text"
                placeholder="gestor@imob.com, diretor@imob.com"
                value={reportEmails}
                onChange={(e) => setReportEmails(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="avmDeviationPct" style={labelStyle}>
                Desvio máximo vs. AVM (%)
              </label>
              <input
                id="avmDeviationPct"
                type="number"
                min={1}
                max={100}
                value={avmDeviationPct}
                onChange={(e) => setAvmDeviationPct(Number(e.target.value))}
                style={inputStyle}
              />
              <p style={hintStyle}>
                Negócios com valor além deste desvio do estimado geram anomalia.
              </p>
            </div>

            {error && (
              <p style={{ color: C.negative, fontSize: '0.8125rem', margin: 0 }}>{error}</p>
            )}
            {saved && (
              <p style={{ color: C.positive, fontSize: '0.8125rem', margin: 0 }}>
                Configuração salva.
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '0.75rem',
                background: C.accent,
                color: '#04110a',
                border: 'none',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: '0.875rem',
                fontFamily: 'var(--font-body)',
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Salvando…' : 'Salvar configuração'}
            </button>

            {webhookUrl && (
              <div
                style={{
                  background: C.surface2,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: '0.875rem',
                }}
              >
                <p style={{ ...labelStyle, marginBottom: '0.5rem' }}>
                  URL do webhook (configure no Vista CRM)
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <code
                    style={{
                      flex: 1,
                      color: C.text,
                      fontSize: '0.75rem',
                      wordBreak: 'break-all',
                    }}
                  >
                    {webhookUrl}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    style={{
                      padding: '0.375rem 0.75rem',
                      background: copied ? C.accentMid : C.surface3,
                      color: copied ? C.accent : C.text2,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-body)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
