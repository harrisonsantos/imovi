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
    // Mapeia `.js` especificado em imports TS para o arquivo `.ts` real — padrão
    // ESM NodeNext. Sem esse extensionAlias, `import './foo.js'` dentro de um
    // package workspace TS quebra no bundle do Next.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
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

