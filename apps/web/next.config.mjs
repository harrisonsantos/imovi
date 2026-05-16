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

  // Pacotes do monorepo em TS bruto (main aponta pra src/*.ts) — Next precisa
  // transpilá-los. Sem isso, webpack falha a resolver os imports `.js` internos
  // dos barrels (ex.: `@imovi/db` → `./repositories/scrape-errors.js` não existe,
  // só `.ts`).
  transpilePackages: ['@imovi/db', '@imovi/ml-infer', '@imovi/shared'],

  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    // onnxruntime-node é binário nativo — infer.ts faz import dinâmico com
    // fallback (try-catch) para ambientes sem o módulo. Sem este alias o
    // webpack tenta resolver os .node binários e falha no bundle edge.
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      'onnxruntime-node': false,
    };
    return config;
  },
};

// Em desenvolvimento, injeta as bindings do wrangler.toml (KV, R2, etc.)
// O await top-level só funciona em ESM — next.config.mjs já é ESM, ok.
if (process.env.NODE_ENV === 'development') {
  await setupDevPlatform();
}

export default nextConfig;

