import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'imovi — Avaliação de imóveis',
    short_name: 'imovi',
    description: 'Estimativa gratuita do valor de mercado de imóveis no Brasil.',
    start_url: '/',
    display: 'standalone',
    background_color: '#07090e',
    theme_color: '#00d97e',
    lang: 'pt-BR',
  };
}
