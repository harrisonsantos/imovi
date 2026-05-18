'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from './Logo';
import { tokens as C } from '@/lib/tokens';

const NAV_LINKS: [string, string][] = [
  ['Como funciona', '/#como-funciona'],
  ['Metodologia',   '/metodologia'],
  ['Preços',        '/precos'],
  ['Dashboard',     '/dashboard'],
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 48);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <nav style={{
      position:      'fixed',
      top: 0, left: 0, right: 0,
      zIndex:        1000,
      height:        '60px',
      display:       'flex',
      alignItems:    'center',
      padding:       '0 clamp(1rem,4vw,2.5rem)',
      background:    scrolled ? 'rgba(7,9,14,0.93)' : 'transparent',
      backdropFilter:scrolled ? 'blur(18px)'          : 'none',
      borderBottom:  `1px solid ${scrolled ? C.border : 'transparent'}`,
      transition:    'all 0.25s ease',
    }}>
      <Logo size={22} />

      <div style={{ flex: 1 }} />

      {/* Desktop links */}
      <div className="nav-links" style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
        {NAV_LINKS.map(([label, href]) => (
          <Link
            key={label}
            href={href}
            style={{
              padding:        '0.4375rem 0.875rem',
              color:          C.text2,
              textDecoration: 'none',
              fontSize:       '0.875rem',
              fontWeight:     500,
              borderRadius:   '6px',
              transition:     'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color      = C.text;
              (e.currentTarget as HTMLElement).style.background = C.surface2;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color      = C.text2;
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            {label}
          </Link>
        ))}
      </div>

      <Link
        href="/#estimar"
        style={{
          marginLeft:     '0.75rem',
          padding:        '0.5rem 1.25rem',
          background:     C.accent,
          color:          '#000',
          textDecoration: 'none',
          fontSize:       '0.875rem',
          fontWeight:     700,
          borderRadius:   '8px',
          transition:     'transform 0.15s',
          whiteSpace:     'nowrap',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}
      >
        Estimar agora
      </Link>
    </nav>
  );
}
