/**
 * Landing + formulário de estimativa — MVP Curitiba/PR.
 *
 * Separada do client component para permitir SSR da landing (sem JS no header).
 */
import EstimateForm from './estimate-form';

export const runtime = 'edge';

// JSON-LD schema.org para melhor indexação e rich results.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Imovi',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
  inLanguage: 'pt-BR',
  url: 'https://imovi.app.br',
  description: 'Estimativa de valor de imóveis em Curitiba/PR',
};

export default function HomePage() {
  // Turnstile site key é public — pode vir pro client via prop.
  // Em dev local (ausente) o form pula o widget.
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <main
      style={{
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: '#0f172a',
        maxWidth: '720px',
        margin: '0 auto',
        padding: '3rem 1.25rem 5rem',
        lineHeight: 1.5,
      }}
    >
      {/* JSON-LD inline — seguro pois conteúdo é estático e controlado. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header style={{ marginBottom: '2.5rem' }}>
        <p
          style={{
            fontSize: '0.75rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#2563eb',
            margin: 0,
            fontWeight: 600,
          }}
        >
          Imovi
        </p>
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            margin: '0.25rem 0 0.75rem',
            letterSpacing: '-0.02em',
          }}
        >
          Estime o valor do seu imóvel em Curitiba
        </h1>
        <p style={{ color: '#475569', margin: 0, fontSize: '1.0625rem' }}>
          FIPE de imóveis — estimativa baseada em dados de mercado. MVP cobrindo Curitiba/PR.
        </p>
      </header>

      <EstimateForm siteKey={turnstileSiteKey} />

      <footer style={{ marginTop: '3rem', fontSize: '0.8125rem', color: '#64748b' }}>
        <p style={{ margin: 0 }}>
          © {new Date().getFullYear()} Imovi — estimativa automatizada (AVM). Valores informativos,
          não substituem avaliação profissional.
        </p>
      </footer>
    </main>
  );
}
