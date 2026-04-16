import { describe, it, expect } from 'vitest';
import { ProxyRotator } from '../src/core/proxy-rotator.js';

describe('ProxyRotator', () => {
  it('rotaciona 3 proxies em round-robin, 6 chamadas = 2 usos de cada', () => {
    const proxies = ['http://p1', 'http://p2', 'http://p3'];
    const rot = new ProxyRotator(proxies);

    const seq = Array.from({ length: 6 }, () => rot.next());

    expect(seq).toEqual([
      'http://p1',
      'http://p2',
      'http://p3',
      'http://p1',
      'http://p2',
      'http://p3',
    ]);
  });

  it('retorna null quando lista vazia', () => {
    const rot = new ProxyRotator([]);
    expect(rot.next()).toBeNull();
  });
});
