import type { MetadataRoute } from 'next';

export const runtime = 'edge';

/**
 * Sitemap mínimo — apenas landing por ora.
 * Expandir quando houver páginas de bairro/relatório públicas.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://imovi.app.br',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
