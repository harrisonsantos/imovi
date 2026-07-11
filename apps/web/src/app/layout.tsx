import type { Metadata } from 'next';
import { Syne, DM_Sans, DM_Mono } from 'next/font/google';
import './globals.css';
import { ConsentBanner } from '@/components/ads/ConsentBanner';
import { SITE_NAME, SITE_URL } from '@/lib/seo';

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

const TITLE = 'Quanto vale meu imóvel? Avaliação gratuita | imovi';
const DESCRIPTION =
  'Calcule o valor estimado do seu imóvel grátis, com dados reais de preço por m², bairro e características do imóvel.';
const ADSENSE_ID  = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s | ${SITE_NAME}` },
  applicationName: SITE_NAME,
  description: DESCRIPTION,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'real estate',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    locale: 'pt_BR',
    siteName: SITE_NAME,
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  ...(ADSENSE_ID ? { other: { 'google-adsense-account': ADSENSE_ID } } : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${syne.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <body>
        {children}
        <ConsentBanner />
      </body>
    </html>
  );
}
