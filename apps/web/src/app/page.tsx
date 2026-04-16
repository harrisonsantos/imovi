// Edge runtime — necessário para Cloudflare Pages Functions
export const runtime = 'edge';

export default function HomePage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '640px', margin: '0 auto' }}>
      <h1>Imovi 🏠</h1>
      <p>AVM (Automated Valuation Model) para imóveis no Brasil.</p>
      <p style={{ color: '#666', fontSize: '0.875rem' }}>
        Deploy via Cloudflare Pages — ambiente:{' '}
        <code>{process.env.NEXT_PUBLIC_APP_ENV ?? 'local'}</code>
      </p>
    </main>
  );
}
