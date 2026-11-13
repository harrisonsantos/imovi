import { CuritibaIptuAdapter, InfoSimplesAdapter } from '@imovi/enrichment';
import type { Logger } from '../logger.js';

/** Composição da CLI/cron. Nunca logar env, URL completa ou token. */
export function createIptuAdapters(
  env: { INFOSIMPLES_TOKEN?: string; INFOSIMPLES_CURITIBA_ENDPOINT?: string },
  logger: Logger,
  fetchFn?: typeof fetch,
) {
  const apiToken = env.INFOSIMPLES_TOKEN?.trim();
  if (!apiToken) throw new Error('INFOSIMPLES_TOKEN ausente');
  const config = { apiToken, logger, fetchFn };
  const endpoint = env.INFOSIMPLES_CURITIBA_ENDPOINT?.trim();
  if (endpoint) {
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new Error('INFOSIMPLES_CURITIBA_ENDPOINT inválido');
    }
    if (
      url.origin !== 'https://api.infosimples.com' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error('INFOSIMPLES_CURITIBA_ENDPOINT inválido');
    }
  }
  return {
    infoSimples: new InfoSimplesAdapter(config),
    curitiba: endpoint ? new CuritibaIptuAdapter({ ...config, endpoint }) : undefined,
  };
}
