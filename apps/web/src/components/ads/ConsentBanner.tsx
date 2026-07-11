'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CONSENT_EVENT, CONSENT_STORAGE_KEY, readConsent, type ConsentChoice } from '@/lib/consent';
import { tokens as C } from '@/lib/tokens';

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => setVisible(readConsent() === null), []);

  function choose(value: ConsentChoice) {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
    setVisible(false);
  }

  if (!visible) return null;
  return (
    <aside
      aria-label="Preferências de privacidade"
      style={{
        position: 'fixed',
        left: '1rem',
        right: '1rem',
        bottom: '1rem',
        zIndex: 1000,
        maxWidth: 760,
        margin: '0 auto',
        padding: '1rem',
        background: C.surface,
        border: `1px solid ${C.borderMid}`,
        borderRadius: 12,
        boxShadow: '0 18px 60px rgba(0,0,0,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap',
      }}
    >
      <p style={{ color: C.text2, fontSize: '0.8125rem', lineHeight: 1.55, flex: '1 1 360px' }}>
        Usamos armazenamento essencial para o site funcionar. Com sua autorização, exibimos anúncios
        contextuais não personalizados para manter a estimativa gratuita.{' '}
        <Link href="/privacidade" style={{ color: C.accent }}>
          Saiba mais
        </Link>
        .
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => choose('essential')}
          style={{
            padding: '0.625rem 0.8rem',
            background: C.surface2,
            color: C.text2,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Somente essenciais
        </button>
        <button
          type="button"
          onClick={() => choose('ads')}
          style={{
            padding: '0.625rem 0.8rem',
            background: C.accent,
            color: '#000',
            border: `1px solid ${C.accent}`,
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          Aceitar anúncios
        </button>
      </div>
    </aside>
  );
}
