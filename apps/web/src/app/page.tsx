import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { EstimateForm } from '@/components/EstimateForm';
import { FAQ } from '@/components/FAQ';
import { Footer } from '@/components/Footer';
import { AdSlot } from '@/components/ads/AdSlot';
import { JsonLd } from '@/components/JsonLd';
import { SITE_NAME, SITE_URL } from '@/lib/seo';


export const metadata: Metadata = {
  title: { absolute: 'Quanto vale meu imóvel? Avaliação gratuita | imovi' },
  description:
    'Estimativa heurística gratuita por cidade, bairro, área e características, com origem da referência e limitações visíveis.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Quanto vale meu imóvel? Avaliação gratuita',
    description:
      'Estime gratuitamente uma referência de valor por m² e conheça as limitações do cálculo.',
    url: '/',
  },
};

export default function HomePage() {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              '@id': `${SITE_URL}/#organization`,
              name: SITE_NAME,
              url: SITE_URL,
              email: 'hrrsnp@gmail.com',
            },
            {
              '@type': 'WebSite',
              '@id': `${SITE_URL}/#website`,
              url: SITE_URL,
              name: SITE_NAME,
              inLanguage: 'pt-BR',
              publisher: { '@id': `${SITE_URL}/#organization` },
            },
            {
              '@type': 'WebApplication',
              '@id': `${SITE_URL}/#app`,
              name: 'Avaliador de imóveis imovi',
              url: SITE_URL,
              applicationCategory: 'FinanceApplication',
              operatingSystem: 'Web',
              inLanguage: 'pt-BR',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
              description:
                'Estimativa automatizada e gratuita do valor de mercado de imóveis no Brasil.',
            },
          ],
        }}
      />
      <Nav />
      <Hero />
      <HowItWorks />
      <EstimateForm siteKey={turnstileSiteKey} />
      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME} />
      <FAQ />
      <Footer />
    </>
  );
}
