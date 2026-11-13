import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Planos e preços do imovi',
  description:
    'Estimativa básica gratuita de valor de imóveis e planos da auditoria de vendas para imobiliárias que usam o Vista CRM.',
  alternates: { canonical: '/precos/' },
  openGraph: {
    title: 'Planos e preços do imovi',
    description: 'Estimativa gratuita de valor e auditoria de vendas para imobiliárias.',
    url: '/precos/',
  },
};

export default function PrecosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
