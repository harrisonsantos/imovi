import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

// Rotas dinâmicas continuam SSR. Prerenders usam assets versionados do build;
// o app não usa ISR/revalidateTag e não precisa de um novo bucket de cache.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
