import base from '@imovi/config/vitest/base';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(base, {
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
