import type { MetadataRoute } from 'next';
import { getSeoCatalog } from '@/lib/seo-data';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticLastModified = new Date('2026-07-11T00:00:00-03:00');
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: staticLastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/valor-imovel/`,
      lastModified: staticLastModified,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/precos/`,
      lastModified: staticLastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/metodologia/`,
      lastModified: staticLastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/privacidade/`,
      lastModified: staticLastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/termos/`,
      lastModified: staticLastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  try {
    const cities = await getSeoCatalog();
    for (const city of cities) {
      if (city.indexableNeighborhoods.length === 0) continue;
      entries.push({
        url: `${SITE_URL}/valor-imovel/${city.slug}/`,
        lastModified: city.lastAggregatedAt ?? staticLastModified,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
      for (const neighborhood of city.indexableNeighborhoods) {
        entries.push({
          url: `${SITE_URL}/valor-imovel/${city.slug}/${neighborhood.slug}/`,
          lastModified: neighborhood.lastAggregatedAt ?? staticLastModified,
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
    }
  } catch (error) {
    console.error('[sitemap] catálogo dinâmico indisponível:', error);
  }

  return entries;
}
