import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Resultado da estimativa',
  robots: { index: false, follow: false, nocache: true },
};

export default function ResultadosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
