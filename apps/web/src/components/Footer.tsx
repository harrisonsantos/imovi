import Link from 'next/link';
import { Logo } from './Logo';
import { tokens as C } from '@/lib/tokens';

const LINKS: [string, [string, string][]][] = [
  ['Produto', [
    ['Como funciona', '/#como-funciona'],
    ['Metodologia',   '/metodologia'],
    ['Planos',        '/precos'],
    ['Dashboard',     '/dashboard'],
  ]],
  ['Cidades', [
    ['Curitiba/PR',             '/#estimar'],
    ['São Paulo (em breve)',     '#'],
    ['Porto Alegre',            '#'],
    ['Florianópolis',           '#'],
  ]],
  ['Legal', [
    ['Privacidade',  '#'],
    ['Termos de uso','#'],
    ['Contato',      '#'],
  ]],
];

export function Footer() {
  return (
    <footer style={{ padding: 'clamp(3rem,5vh,4.5rem) clamp(1rem,4vw,2.5rem)', borderTop: `1px solid ${C.border}`, background: C.bg }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '2.5rem', marginBottom: '2.5rem' }}>
          <div>
            <Logo size={22} />
            <p style={{ marginTop: '0.875rem', fontSize: '0.875rem', color: C.text2, maxWidth: '260px', lineHeight: 1.65 }}>
              A FIPE dos imóveis brasileiros. Estimativas instantâneas baseadas em dados de mercado real.
            </p>
          </div>

          <div className="footer-cols" style={{ display: 'flex', gap: '3.5rem', flexWrap: 'wrap' }}>
            {LINKS.map(([title, links]) => (
              <div key={title}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: C.text, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.875rem' }}>
                  {title}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5625rem' }}>
                  {links.map(([label, href]) => (
                    <Link
                      key={label}
                      href={href}
                      style={{ fontSize: '0.875rem', color: C.text2, textDecoration: 'none', transition: 'color 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.text; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.text2; }}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ paddingTop: '1.5rem', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <p style={{ fontSize: '0.8125rem', color: C.text3 }}>
            © {new Date().getFullYear()} imovi. Os valores exibidos são estimativas e não constituem laudo de avaliação.
          </p>
        </div>
      </div>
    </footer>
  );
}
