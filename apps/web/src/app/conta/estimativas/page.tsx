'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BillingButton } from '@/components/billing/BillingButton';
import { useEntitlements } from '@/lib/use-entitlements';
import type { PublicEstimate } from '@/lib/public-estimate';
import { tokens as C } from '@/lib/tokens';

interface HistoryEntry {
  id: string;
  createdAt: string;
  result: PublicEstimate | null;
}

export default function HistoryPage() {
  const entitlements = useEntitlements();
  const [rows, setRows] = useState<HistoryEntry[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const load = useCallback(async (offset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/conta/estimativas?offset=${offset}`, {
        cache: 'no-store',
      });
      if (response.status === 401) {
        setUnauthorized(true);
        return;
      }
      if (!response.ok) throw new Error('Não foi possível carregar suas estimativas.');
      const data = (await response.json()) as {
        estimates: HistoryEntry[];
        nextOffset: number | null;
      };
      setRows((previous) => (offset === 0 ? data.estimates : [...previous, ...data.estimates]));
      setNextOffset(data.nextOffset);
    } catch {
      setError('Não foi possível carregar suas estimativas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <main
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '3rem 1.5rem',
        color: C.text,
        lineHeight: 1.7,
      }}
    >
      <h1>Minhas estimativas</h1>
      <p>
        Registro das próprias estimativas feitas na conta. As estimativas são heurísticas, com faixa
        indicativa de ±30%: não é um intervalo estatístico validado nem um laudo de avaliação.
      </p>
      <p>
        <Link href="/#estimar">Fazer uma estimativa</Link>
        {' · '}
        <Link href="/precos">Planos</Link>
      </p>
      {entitlements?.quota && (
        <p>
          {entitlements.quota.used} de {entitlements.quota.limit} estimativas usadas;{' '}
          {entitlements.quota.remaining} restantes. Renovação:{' '}
          {new Date(entitlements.quota.renewsAt).toLocaleString('pt-BR', { timeZone: 'UTC' })} UTC.
        </p>
      )}
      {unauthorized ? (
        <p>
          <Link href="/conta/login">Entre na sua conta</Link> para ver suas estimativas.
        </p>
      ) : (
        <>
          {entitlements?.authenticated && entitlements.plan === 'corretor_pro' && (
            <div style={{ maxWidth: 320 }}>
              {!entitlements.quota && (
                <BillingButton planId="corretor_pro" label="Assinar Corretor Pro" />
              )}
              <BillingButton mode="portal" label="Gerenciar assinatura" />
            </div>
          )}
          {loading && <p role="status">Carregando…</p>}
          {error && (
            <p role="alert">
              {error} <button onClick={() => void load()}>Tentar novamente</button>
            </p>
          )}
          {!loading && !error && rows.length === 0 && (
            <p>Você ainda não tem estimativas salvas nesta conta.</p>
          )}
          <ul>
            {rows.map((row) => (
              <li key={row.id} style={{ marginBottom: '1rem' }}>
                {new Date(row.createdAt).toLocaleString('pt-BR')}
                {' — '}
                {row.result ? (
                  <Link href={`/resultados?id=${encodeURIComponent(row.id)}`}>
                    {row.result.property.neighborhood}, {row.result.property.city} ·{' '}
                    {row.result.property.area} m² ·{' '}
                    {row.result.estimate.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </Link>
                ) : (
                  'Estimativa antiga sem detalhes disponíveis.'
                )}
              </li>
            ))}
          </ul>
          {nextOffset !== null && (
            <button disabled={loading} onClick={() => void load(nextOffset)}>
              Carregar mais
            </button>
          )}
        </>
      )}
    </main>
  );
}
