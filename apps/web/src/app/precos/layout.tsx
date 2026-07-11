import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Planos e preços para corretores e imobiliárias',
  description:
    'Compare os planos do imovi para avaliação de imóveis, relatórios, API e auditoria de vendas para imobiliárias.',
  alternates: { canonical: '/precos/' },
  openGraph: {
    title: 'Planos e preços do imovi',
    description: 'Avaliação imobiliária e auditoria de vendas para profissionais e imobiliárias.',
    url: '/precos/',
  },
};

export default function PrecosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
