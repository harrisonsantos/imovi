import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Imovi — AVM para imóveis no Brasil',
  description: 'Avaliação automatizada de imóveis com dados reais do mercado brasileiro.',
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
