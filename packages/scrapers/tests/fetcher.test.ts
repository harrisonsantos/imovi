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
});
