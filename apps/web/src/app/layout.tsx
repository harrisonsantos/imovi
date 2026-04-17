import type { Metadata } from 'next';

const TITLE = 'Imovi — FIPE de Imóveis · Estimativa de valor em Curitiba';
const DESCRIPTION =
  'Estime o valor de mercado do seu imóvel em Curitiba em segundos. Baseado em dados agregados de bairro. Grátis.';
const URL = 'https://imovi.app.br';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'avaliação imóvel curitiba',
    'quanto vale meu apartamento',
    'FIPE imóveis',
    'valor imóvel PR',
    'estimativa imóvel',
  ],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    locale: 'pt_BR',
    url: URL,
    siteName: 'Imovi',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
