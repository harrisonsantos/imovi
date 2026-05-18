import type { Metadata } from 'next';
import { Syne, DM_Sans, DM_Mono } from 'next/font/google';
import './globals.css';

const syne = Syne({
  subsets:  ['latin'],
  weight:   ['600', '700', '800'],
  variable: '--font-syne',
  display:  'swap',
});
const dmSans = DM_Sans({
  subsets:  ['latin'],
  weight:   ['400', '500', '600'],
  variable: '--font-dm-sans',
  display:  'swap',
});
const dmMono = DM_Mono({
  subsets:  ['latin'],
  weight:   ['400', '500'],
  variable: '--font-dm-mono',
  display:  'swap',
});

const TITLE       = 'imovi — Avaliação automática de imóveis';
const DESCRIPTION = 'Estime o valor de mercado do seu imóvel em segundos. Baseado em dados reais de bairro. Grátis.';
const URL         = 'https://imovi.app.br';

export const metadata: Metadata = {
  title:       TITLE,
  description: DESCRIPTION,
  keywords:    ['avaliação imóvel', 'quanto vale meu apartamento', 'FIPE imóveis', 'estimativa imóvel'],
  alternates:  { canonical: URL },
  robots:      { index: true, follow: true },
  openGraph:   { title: TITLE, description: DESCRIPTION, locale: 'pt_BR', url: URL, siteName: 'imovi', type: 'website' },
  twitter:     { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${syne.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
