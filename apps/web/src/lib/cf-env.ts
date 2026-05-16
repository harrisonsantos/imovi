export async function getCfEnv(): Promise<Record<string, string>> {
  const { getRequestContext } = await import('@cloudflare/next-on-pages');
  return getRequestContext().env as Record<string, string>;
}
