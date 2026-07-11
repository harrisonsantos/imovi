'use client';

import { useState } from 'react';
import type { BillingPlanId } from '@/lib/billing';
import { tokens as C } from '@/lib/tokens';

interface BillingButtonProps {
  planId?: BillingPlanId;
  mode?: 'checkout' | 'portal';
  label: string;
  highlighted?: boolean;
}

export function BillingButton({
  planId,
  mode = 'checkout',
  label,
  highlighted = false,
}: BillingButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/${mode === 'portal' ? 'portal' : 'checkout'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: mode === 'checkout' ? JSON.stringify({ planId }) : undefined,
      });
      const body = (await res.json().catch(() => null)) as {
        url?: string;
        message?: string;
      } | null;
      if (res.status === 401) {
        window.location.href = '/auditoria/login';
        return;
      }
      if (!res.ok || !body?.url) {
        setError(body?.message ?? 'Não foi possível abrir a cobrança.');
        return;
      }
      window.location.href = body.url;
    } catch {
      setError('Falha de rede. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          display: 'block',
          width: '100%',
          padding: '0.625rem',
          background: highlighted ? C.accent : C.accentDim,
          border: `1px solid ${highlighted ? C.accent : C.accentMid}`,
          color: highlighted ? '#000' : C.accent,
          textAlign: 'center',
          fontSize: '0.8125rem',
          fontWeight: 700,
          borderRadius: '8px',
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Abrindo…' : label}
      </button>
      {error && (
        <p role="alert" style={{ color: C.negative, fontSize: '0.6875rem', marginTop: '0.5rem' }}>
          {error}
        </p>
      )}
    </div>
  );
}
