import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from '../src/core/rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('respeita 1 req/s por host (duas chamadas ao mesmo host esperam >=1s)', async () => {
    const limiter = new RateLimiter({ minIntervalMs: 1000 });

    const first = limiter.acquire('zapimoveis.com.br');
    await first;

    let secondResolved = false;
    const second = limiter.acquire('zapimoveis.com.br').then(() => {
      secondResolved = true;
    });

    // Avança só 500ms — ainda não deve ter liberado
    await vi.advanceTimersByTimeAsync(500);
    expect(secondResolved).toBe(false);

    // Avança o resto para chegar a 1000ms
    await vi.advanceTimersByTimeAsync(500);
    await second;
    expect(secondResolved).toBe(true);
  });

  it('permite hosts diferentes em paralelo (sem bloqueio cruzado)', async () => {
    const limiter = new RateLimiter({ minIntervalMs: 1000 });

    await limiter.acquire('zapimoveis.com.br');

    let otherResolved = false;
    const other = limiter.acquire('vivareal.com.br').then(() => {
      otherResolved = true;
    });

    // Sem avançar tempo, já deve ter resolvido (host diferente)
    await vi.advanceTimersByTimeAsync(0);
    await other;
    expect(otherResolved).toBe(true);
  });
});
