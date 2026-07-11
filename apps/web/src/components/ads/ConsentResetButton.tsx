'use client';

import { CONSENT_STORAGE_KEY } from '@/lib/consent';
import { tokens as C } from '@/lib/tokens';

export function ConsentResetButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.localStorage.removeItem(CONSENT_STORAGE_KEY);
        window.location.reload();
      }}
      style={{
        padding: '0.625rem 0.8rem',
        background: C.accentDim,
        color: C.accent,
        border: `1px solid ${C.accentMid}`,
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 600,
      }}
    >
      Rever preferências de privacidade
    </button>
  );
}
