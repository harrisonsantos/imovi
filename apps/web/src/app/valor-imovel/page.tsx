import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { SeoPageShell } from '@/components/seo/SeoPageShell';
import { getSeoCatalog } from '@/lib/seo-data';
import { SITE_URL } from '@/lib/seo';
import { tokens as C } from '@/lib/tokens';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Preço do m² e valor de imóveis por cidade',
  description:
    'Consulte preços medianos por m² e estime o valor de imóveis nas cidades e bairros cobertos pelo imovi.',
  alternates: { canonical: '/valor-imovel/' },
  openGraph: {
    title: 'Preço do m² por cidade e bairro',
    description: 'Dados imobiliários locais e estimativa gratuita de valor de imóveis.',
    url: '/valor-imovel/',
  },
};

const brlM2 = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });

export default async function ValorImovelPage() {
  const cities = (await getSeoCatalog()).filter((city) => city.indexableNeighborhoods.length > 0);

  return (
    <SeoPageShell crumbs={[{ label: 'Início', href: '/' }, { label: 'Preço de imóveis' }]}>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Preço do m² e valor de imóveis por cidade',
          url: `${SITE_URL}/valor-imovel/`,
          inLanguage: 'pt-BR',
        }}
      />
      <header style={{ maxWidth: 780, marginBottom: '2.5rem' }}>
        <p
          style={{
            color: C.accent,
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '.12em',
            marginBottom: '.75rem',
          }}
        >
          Mercado imobiliário local
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2rem,5vw,3.5rem)',
            lineHeight: 1.08,
            letterSpacing: '-.04em',
            marginBottom: '1rem',
          }}
        >
          Preço do m² e valor de imóveis por cidade
        </h1>
        <p style={{ color: C.text2, fontSize: '1rem', lineHeight: 1.75 }}>
          Explore dados de bairros com cobertura suficiente e use o avaliador gratuito para
          considerar área, tipo e características do imóvel.
        </p>
      </header>

      <section aria-labelledby="cidades-cobertas">
        <h2 id="cidades-cobertas" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
          Cidades cobertas
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))',
            gap: '1rem',
          }}
        >
          {cities.map((city) => (
            <Link
              key={city.slug}
              href={`/valor-imovel/${city.slug}`}
              style={{
                padding: '1.25rem',
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                color: C.text,
                textDecoration: 'none',
              }}
            >
              <strong>
                {city.name}/{city.state}
              </strong>
              <span
                style={{ display: 'block', color: C.text2, fontSize: '.8rem', marginTop: '.45rem' }}
              >
                {city.indexableNeighborhoods.length} bairros com dados
              </span>
              {city.medianPriceM2 && (
                <span
                  style={{
                    display: 'block',
                    color: C.accent,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '.82rem',
                    marginTop: '.75rem',
                  }}
                >
                  mediana entre bairros: {brlM2(city.medianPriceM2)}/m²
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>
    </SeoPageShell>
  );
}
