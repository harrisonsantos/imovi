import { getRequestContext } from '@cloudflare/next-on-pages';

export function getCfEnv(): Record<string, string> {
  return getRequestContext().env as Record<string, string>;
}
