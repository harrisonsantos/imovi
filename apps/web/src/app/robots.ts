import type { MetadataRoute } from 'next';

export const runtime = 'edge';

/**
 * Mantém o crawl concentrado nas páginas públicas com valor de busca.
 * X-Robots-Tag no next.config complementa este arquivo com noindex.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auditoria/', '/dashboard/', '/resultados/'],
    },
    sitemap: 'https://imovi.app.br/sitemap.xml',
  };
}
