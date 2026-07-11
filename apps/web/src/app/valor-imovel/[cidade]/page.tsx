import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/JsonLd';
import { SeoPageShell } from '@/components/seo/SeoPageShell';
import { getSeoCity } from '@/lib/seo-data';
import { SITE_URL } from '@/lib/seo';
import { tokens as C } from '@/lib/tokens';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ cidade: string }> };

const brlM2 = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cidade } = await params;
  const city = await getSeoCity(cidade);
  if (!city) return { title: 'Cidade não encontrada', robots: { index: false } };
  const path = `/valor-imovel/${city.slug}/`;
  return {
    title: `Quanto vale um imóvel em ${city.name}? Preço por m²`,
    description: `Consulte o preço mediano por m² nos bairros de ${city.name}/${city.state} e faça uma estimativa gratuita do valor do seu imóvel.`,
    alternates: { canonical: path },
    robots: { index: city.indexableNeighborhoods.length > 0, follow: true },
    openGraph: {
      title: `Preço de imóveis em ${city.name}/${city.state}`,
      description: `Veja preços por m² em ${city.indexableNeighborhoods.length} bairros com dados de mercado.`,
      url: path,
    },
  };
}

export default async function CidadePage({ params }: Props) {
  const { cidade } = await params;
  const city = await getSeoCity(cidade);
  if (!city || city.indexableNeighborhoods.length === 0) notFound();
  const ordered = [...city.indexableNeighborhoods].sort(
    (a, b) => b.medianPriceM2 - a.medianPriceM2,
  );
  const updated = city.lastAggregatedAt?.toLocaleDateString('pt-BR') ?? 'data recente';

  return (
    <SeoPageShell
      crumbs={[
        { label: 'Início', href: '/' },
        { label: 'Preço de imóveis', href: '/valor-imovel' },
        { label: `${city.name}/${city.state}` },
      ]}
    >
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebPage',
              name: `Preço de imóveis em ${city.name}/${city.state}`,
              url: `${SITE_URL}/valor-imovel/${city.slug}/`,
              dateModified: city.lastAggregatedAt?.toISOString(),
              inLanguage: 'pt-BR',
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
                { '@type': 'ListItem', position: 3, name: `${city.name}/${city.state}` },
              ],
            },
          ],
        }}
      />
      <header style={{ maxWidth: 800, marginBottom: '2.5rem' }}>
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
          Dados atualizados em {updated}
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
          Quanto vale um imóvel em {city.name}?
        </h1>
        <p style={{ color: C.text2, lineHeight: 1.75, fontSize: '1rem' }}>
          A mediana dos preços por m² entre os bairros com cobertura é{' '}
          <strong style={{ color: C.text }}>
            {city.medianPriceM2 ? `${brlM2(city.medianPriceM2)}/m²` : 'variável'}
          </strong>
          . Compare bairros abaixo e refine a estimativa com as características do imóvel.
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
          Avaliar meu imóvel grátis →
        </Link>
      </header>

      <section aria-labelledby="precos-bairros" style={{ marginBottom: '3rem' }}>
        <h2 id="precos-bairros" style={{ fontSize: '1.35rem', marginBottom: '.5rem' }}>
          Preço do m² por bairro em {city.name}
        </h2>
        <p style={{ color: C.text2, fontSize: '.85rem', lineHeight: 1.6, marginBottom: '1rem' }}>
          Medianas calculadas a partir de anúncios observados. Não representam preço garantido de
          venda.
        </p>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {ordered.map((neighborhood, index) => (
            <Link
              key={neighborhood.slug}
              href={`/valor-imovel/${city.slug}/${neighborhood.slug}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '1rem',
                padding: '1rem 1.15rem',
                background: index % 2 === 0 ? C.surface : C.surface2,
                color: C.text,
                textDecoration: 'none',
                borderBottom: index < ordered.length - 1 ? `1px solid ${C.border}` : 'none',
              }}
            >
              <span>{neighborhood.name}</span>
              <strong
                style={{ color: C.accent, fontFamily: 'var(--font-mono)', fontSize: '.85rem' }}
              >
                {brlM2(neighborhood.medianPriceM2)}/m²
              </strong>
            </Link>
          ))}
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
          gap: '1rem',
        }}
      >
        {[
          [
            'O que altera o valor?',
            'Localização, área, tipo, dormitórios, banheiros, vagas, conservação, andar, posição solar e padrão do condomínio podem mudar bastante o preço.',
          ],
          [
            'Mediana não é avaliação final',
            'O preço por m² do bairro é uma referência inicial. O avaliador combina esse contexto com as características informadas e apresenta um intervalo de confiança.',
          ],
          [
            'Como usar os dados',
            'Compare imóveis realmente semelhantes e valide documentação, estado e liquidez antes de tomar uma decisão de compra, venda ou garantia.',
          ],
        ].map(([title, text]) => (
          <article
            key={title}
            style={{
              padding: '1.25rem',
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
            }}
          >
            <h2 style={{ fontSize: '1rem', marginBottom: '.55rem' }}>{title}</h2>
            <p style={{ color: C.text2, fontSize: '.85rem', lineHeight: 1.65 }}>{text}</p>
          </article>
        ))}
      </section>
    </SeoPageShell>
  );
}
