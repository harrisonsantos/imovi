'use client';

import { useEffect, useState } from 'react';

export interface Entitlements {
  authenticated: boolean;
  product: 'audit' | 'corretor_pro' | null;
  plan: string | null;
  ads: boolean;
  history: boolean;
  quota: { limit: number; used: number; remaining: number; renewsAt: string } | null;
}

/** null also covers failures: do not flash ads while subscriber rights are unknown. */
export function useEntitlements() {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      void fetch('/api/me/entitlements', { cache: 'no-store', signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('Entitlements unavailable');
          return response.json() as Promise<Entitlements>;
        })
        .then((data) => {
          if (!controller.signal.aborted) setEntitlements(data);
        })
        .catch(() => {
          if (!controller.signal.aborted) setEntitlements(null);
        });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return entitlements;
}
