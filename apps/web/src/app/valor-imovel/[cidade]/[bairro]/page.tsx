import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/JsonLd';
import { SeoPageShell } from '@/components/seo/SeoPageShell';
import { getSeoNeighborhood } from '@/lib/seo-data';
import { SITE_URL } from '@/lib/seo';
import { tokens as C } from '@/lib/tokens';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ cidade: string; bairro: string }> };

const brl = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cidade, bairro } = await params;
  const data = await getSeoNeighborhood(cidade, bairro);
  if (!data) return { title: 'Bairro não encontrado', robots: { index: false } };
  const { city, neighborhood } = data;
  const path = `/valor-imovel/${city.slug}/${neighborhood.slug}/`;
  return {
    title: `Preço do m² em ${neighborhood.name}, ${city.name}`,
    description: `Veja o preço mediano por m² no bairro ${neighborhood.name}, em ${city.name}/${city.state}, exemplos por área e estimativa gratuita de imóvel.`,
    alternates: { canonical: path },
    openGraph: {
      title: `Preço de imóveis em ${neighborhood.name} — ${city.name}`,
      description: `Mediana de ${brl(neighborhood.medianPriceM2)}/m² com base em dados recentes de mercado.`,
      url: path,
    },
  };
}

export default async function BairroPage({ params }: Props) {
  const { cidade, bairro } = await params;
  const data = await getSeoNeighborhood(cidade, bairro);
  if (!data) notFound();
  const { city, neighborhood } = data;
  const related = city.indexableNeighborhoods
    .filter((item) => item.slug !== neighborhood.slug)
    .sort(
      (a, b) =>
        Math.abs(a.medianPriceM2 - neighborhood.medianPriceM2) -
        Math.abs(b.medianPriceM2 - neighborhood.medianPriceM2),
    )
    .slice(0, 6);
  const updated = neighborhood.lastAggregatedAt?.toLocaleDateString('pt-BR') ?? 'data recente';
  const path = `/valor-imovel/${city.slug}/${neighborhood.slug}/`;

  return (
    <SeoPageShell
      crumbs={[
        { label: 'Início', href: '/' },
        { label: 'Preço de imóveis', href: '/valor-imovel' },
        { label: `${city.name}/${city.state}`, href: `/valor-imovel/${city.slug}` },
        { label: neighborhood.name },
      ]}
    >
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebPage',
              name: `Preço do m² em ${neighborhood.name}, ${city.name}`,
              url: `${SITE_URL}${path}`,
              dateModified: neighborhood.lastAggregatedAt?.toISOString(),
              inLanguage: 'pt-BR',
              isPartOf: { '@id': `${SITE_URL}/#website` },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Início', item: SITE_URL },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'Preço de imóveis',
                  item: `${SITE_URL}/valor-imovel/`,
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: `${city.name}/${city.state}`,
                  item: `${SITE_URL}/valor-imovel/${city.slug}/`,
                },
                { '@type': 'ListItem', position: 4, name: neighborhood.name },
              ],
            },
          ],
        }}
      />
      <header style={{ maxWidth: 820, marginBottom: '2.5rem' }}>
        <p
          style={{
            color: C.accent,
            fontFamily: 'var(--font-mono)',
            fontSize: '.7rem',
            textTransform: 'uppercase',
            letterSpacing: '.12em',
            marginBottom: '.75rem',
          }}
        >
          {neighborhood.listingCount} anúncios na amostra · atualizado em {updated}
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
          Preço do m² em {neighborhood.name}, {city.name}
        </h1>
        <p style={{ color: C.text2, fontSize: '1rem', lineHeight: 1.75 }}>
          O preço mediano observado é de{' '}
          <strong style={{ color: C.text }}>{brl(neighborhood.medianPriceM2)}/m²</strong>. Use essa
          referência para comparar faixas de área e depois refine o cálculo no avaliador.
        </p>
        <Link
          href="/#estimar"
          style={{
            display: 'inline-block',
            marginTop: '1.25rem',
            padding: '.75rem 1rem',
            background: C.accent,
            color: '#000',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 700,
          }}
        >
          Calcular valor do meu imóvel →
        </Link>
      </header>

      <section aria-labelledby="exemplos-area" style={{ marginBottom: '3rem' }}>
        <h2 id="exemplos-area" style={{ fontSize: '1.3rem', marginBottom: '.5rem' }}>
          Valores de referência por área
        </h2>
        <p style={{ color: C.text2, fontSize: '.84rem', lineHeight: 1.6, marginBottom: '1rem' }}>
          Multiplicação simples da mediana do bairro; não considera tipo, estado, vagas ou padrão.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
            gap: '1rem',
          }}
        >
          {[50, 75, 100, 150].map((area) => (
            <div
              key={area}
              style={{
                padding: '1.15rem',
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
              }}
            >
              <span style={{ display: 'block', color: C.text2, fontSize: '.75rem' }}>
                Imóvel de {area} m²
              </span>
              <strong
                style={{
                  display: 'block',
                  color: C.accent,
                  fontFamily: 'var(--font-mono)',
                  marginTop: '.5rem',
                }}
              >
                {brl(neighborhood.medianPriceM2 * area)}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '.75rem' }}>
          Como interpretar o preço em {neighborhood.name}
        </h2>
        <div
          style={{
            color: C.text2,
            lineHeight: 1.75,
            fontSize: '.9rem',
            display: 'grid',
            gap: '.8rem',
          }}
        >
          <p>
            A mediana reduz a influência de anúncios muito baratos ou muito caros, mas ainda reflete
            preços anunciados, não necessariamente valores efetivos de transação.
          </p>
          <p>
            Imóveis reformados, novos, bem posicionados ou com vagas podem ficar acima da
            referência. Unidades com manutenção pendente, baixa liquidez ou limitações documentais
            podem ficar abaixo.
          </p>
          <p>
            Para uma decisão financeira ou jurídica, complemente a estimativa automatizada com
            vistoria, matrícula atualizada e avaliação profissional.
          </p>
        </div>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="bairros-proximos-preco">
          <h2 id="bairros-proximos-preco" style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>
            Outros bairros de {city.name} com preço semelhante
          </h2>
          <div style={{ display: 'flex', gap: '.65rem', flexWrap: 'wrap' }}>
            {related.map((item) => (
              <Link
                key={item.slug}
                href={`/valor-imovel/${city.slug}/${item.slug}`}
                style={{
                  padding: '.65rem .8rem',
                  color: C.text2,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontSize: '.82rem',
                }}
              >
                {item.name} · {brl(item.medianPriceM2)}/m²
              </Link>
            ))}
          </div>
        </section>
      )}
    </SeoPageShell>
  );
}
