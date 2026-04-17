import type { MetadataRoute } from 'next';

export const runtime = 'edge';

/**
 * robots.txt nativo do App Router. Bloqueia /api/ para evitar crawl
 * de endpoints dinâmicos (custa compute e não tem conteúdo indexável).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
    },
    sitemap: 'https://imovi.app.br/sitemap.xml',
  };
}
