import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Como calculamos o valor de um imóvel',
  description:
    'Conheça os dados, critérios, intervalos de confiança e limitações usados pelo imovi para estimar o valor de mercado de imóveis.',
  alternates: { canonical: '/metodologia/' },
  openGraph: {
    title: 'Metodologia de avaliação imobiliária do imovi',
    description: 'Como dados reais de mercado são transformados em estimativas de valor.',
    url: '/metodologia/',
  },
};

export default function MetodologiaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
