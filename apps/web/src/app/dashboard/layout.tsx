import type { Metadata } from 'next';

export const metadata: Metadata = {
  // A antiga demonstração com dados fictícios foi retirada: a rota só
  // redireciona para a Auditoria autenticada e fica fora de busca e sitemap.
  title: 'Auditoria',
  robots: { index: false, follow: false, nocache: true },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
