// @ts-check
import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Necessário para @cloudflare/next-on-pages
  // O runtime edge permite rodar na Cloudflare Pages Functions
  // (cada route opt-in individualmente via `export const runtime = 'edge'`)

  // Desabilita Image Optimization — não suportada no CF Pages sem Worker extra
  images: {
    unoptimized: true,
  },

  // Trailing slash melhora o cache hit rate no CF
  trailingSlash: true,
};

// Em desenvolvimento, injeta as bindings do wrangler.toml (KV, R2, etc.)
// O await top-level só funciona em ESM — next.config.mjs já é ESM, ok.
if (process.env.NODE_ENV === 'development') {
  await setupDevPlatform();
}

export default nextConfig;

