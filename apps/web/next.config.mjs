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

  // Impede indexação de APIs, áreas autenticadas e telas demonstrativas.
  // X-Robots-Tag protege inclusive respostas que não renderizam <head>.
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
      },
      {
        source: '/auditoria/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
      },
      {
        source: '/dashboard/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
      },
      {
        source: '/resultados/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
      },
    ];
  },

  // Pacotes do monorepo em TS bruto (main aponta pra src/*.ts) — Next precisa
  // transpilá-los. Sem isso, webpack falha a resolver os imports `.js` internos
  // dos barrels (ex.: `@imovi/db` → `./repositories/scrape-errors.js` não existe,
  // só `.ts`).
  transpilePackages: ['@imovi/db', '@imovi/ml-infer', '@imovi/shared', '@imovi/audit'],

  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    // onnxruntime-node: binário nativo incompatível com edge runtime.
    // onnxruntime-web: WASM runtime (24 MB) excede limite CF Workers de 25 MB.
    // Ambos são importados dinamicamente com try-catch — quando ausentes,
    // estimate/route.ts cai na heurística determinística.
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      'onnxruntime-node': false,
      'onnxruntime-web': false,
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
