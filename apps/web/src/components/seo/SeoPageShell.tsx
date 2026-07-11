import Link from 'next/link';
import type { ReactNode } from 'react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { tokens as C } from '@/lib/tokens';

export interface SeoCrumb {
  label: string;
  href?: string;
}

export function SeoPageShell({ crumbs, children }: { crumbs: SeoCrumb[]; children: ReactNode }) {
  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      <Nav />
      <main style={{ maxWidth: 1040, margin: '0 auto', padding: '7rem 1.25rem 4rem' }}>
        <nav aria-label="Breadcrumb" style={{ marginBottom: '1.5rem' }}>
          <ol
            style={{
              display: 'flex',
              gap: '0.45rem',
              flexWrap: 'wrap',
              listStyle: 'none',
              color: C.text3,
              fontSize: '0.75rem',
            }}
          >
            {crumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} style={{ display: 'flex', gap: '0.45rem' }}>
                {index > 0 && <span aria-hidden="true">/</span>}
                {crumb.href ? (
                  <Link href={crumb.href} style={{ color: C.text2, textDecoration: 'none' }}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        {children}
      </main>
      <Footer />
    </div>
  );
}
