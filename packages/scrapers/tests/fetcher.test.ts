import { describe, it, expect, vi } from 'vitest';
import { Fetcher } from '../src/core/fetcher.js';

describe('Fetcher', () => {
  it('retry com backoff em 429, e sobe contador para 2 requests', async () => {
    let calls = 0;
    const transport = vi.fn(async (_url: string, _init?: RequestInit) => {
      calls += 1;
      if (calls === 1) {
        return new Response('too many', { status: 429, headers: { 'Retry-After': '0' } });
      }
      return new Response('ok', { status: 200 });
    });

    const fetcher = new Fetcher({ transport, maxRetries: 3, baseBackoffMs: 0 });
    const res = await fetcher.get('https://www.zapimoveis.com.br/test');

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
    expect(calls).toBe(2);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('respeita Retry-After quando presente (em segundos)', async () => {
    let calls = 0;
    const transport = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response('slow down', { status: 429, headers: { 'Retry-After': '2' } });
      }
      return new Response('ok', { status: 200 });
    });

    const waits: number[] = [];
    const fetcher = new Fetcher({
      transport,
      maxRetries: 3,
      baseBackoffMs: 10,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });

    const res = await fetcher.get('https://x/y');
    expect(res.status).toBe(200);
    // Espera ≥ 2000ms (Retry-After em segundos) em vez do backoff base
    expect(waits[0]).toBeGreaterThanOrEqual(2000);
  });

  it('preserva cookies de sessão (__cf_bm, _cfuvid) por host entre requisições e envia Accept-Language pt-BR', async () => {
    const seenHeaders: Array<{ url: string; cookie: string | null; acceptLang: string | null }> = [];
    const transport = vi.fn(async (url: string, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      seenHeaders.push({
        url,
        cookie: h.get('cookie'),
        acceptLang: h.get('accept-language'),
      });
      if (url.endsWith('/robots.txt')) {
        return new Response('User-agent: *\nAllow: /', {
          status: 200,
          headers: {
            'set-cookie': '__cf_bm=token123; Path=/; HttpOnly; Secure, _cfuvid=uv456; Path=/',
          },
        });
      }
      return new Response('<html>ok</html>', { status: 200 });
    });

    const fetcher = new Fetcher({ transport, userAgent: 'ImoviBR-Bot/1.0' });
    await fetcher.get('https://www.zapimoveis.com.br/robots.txt');
    await fetcher.get('https://www.zapimoveis.com.br/venda/imoveis/pr+curitiba/?pagina=1');
    await fetcher.get('https://www.olx.com.br/imoveis/venda/estado-pr/curitiba?o=1');

    expect(seenHeaders[0]?.acceptLang).toContain('pt-BR');
    expect(seenHeaders[1]?.cookie).toContain('__cf_bm=token123');
    expect(seenHeaders[1]?.cookie).toContain('_cfuvid=uv456');
    // Host diferente não recebe cookies do zapimoveis
    expect(seenHeaders[2]?.cookie).toBeNull();
  });
});
