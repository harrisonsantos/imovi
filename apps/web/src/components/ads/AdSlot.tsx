'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { CONSENT_EVENT, readConsent } from '@/lib/consent';
import { tokens as C } from '@/lib/tokens';
import { useEntitlements } from '@/lib/use-entitlements';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>> & {
      requestNonPersonalizedAds?: number;
    };
  }
}

export function AdSlot({
  slot,
  format = 'auto',
  adsEnabled,
}: {
  slot?: string;
  format?: string;
  adsEnabled?: boolean;
}) {
  const entitlements = useEntitlements();
  const enabled = adsEnabled ?? entitlements?.ads ?? false;
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const [allowed, setAllowed] = useState(false);
  const [ready, setReady] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    const sync = () => setAllowed(readConsent() === 'ads');
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!enabled || !allowed || !ready || requested.current) return;
    window.adsbygoogle = window.adsbygoogle ?? [];
    window.adsbygoogle.requestNonPersonalizedAds = 1;
    window.adsbygoogle.push({});
    requested.current = true;
  }, [enabled, allowed, ready]);

  if (!enabled || !allowed) return null;
  if (!client || !slot) {
    return process.env.NODE_ENV === 'development' ? (
      <div
        style={{
          maxWidth: 970,
          minHeight: 90,
          margin: '1.5rem auto',
          border: `1px dashed ${C.border}`,
          color: C.text3,
          display: 'grid',
          placeItems: 'center',
          fontSize: '0.6875rem',
        }}
      >
        Espaço de anúncio — configure AdSense para ativar
      </div>
    ) : null;
  }

  return (
    <div
      style={{
        maxWidth: 970,
        minHeight: 90,
        margin: '1.5rem auto',
        padding: '0 1rem',
        textAlign: 'center',
      }}
    >
      <span
        style={{
          display: 'block',
          color: C.text3,
          fontSize: '0.5625rem',
          textTransform: 'uppercase',
          letterSpacing: '.1em',
          marginBottom: 6,
        }}
      >
        Publicidade
      </span>
      <Script
        id="imovi-adsense"
        async
        strategy="afterInteractive"
        crossOrigin="anonymous"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
        onLoad={() => setReady(true)}
      />
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
