/**
 * Rotação round-robin de proxies. Retorna `null` se a lista está vazia.
 */
export class ProxyRotator {
  private readonly proxies: readonly string[];
  private idx = 0;

  constructor(proxies: readonly string[]) {
    this.proxies = [...proxies];
  }

  next(): string | null {
    if (this.proxies.length === 0) return null;
    const proxy = this.proxies[this.idx % this.proxies.length] ?? null;
    this.idx = (this.idx + 1) % this.proxies.length;
    return proxy;
  }

  size(): number {
    return this.proxies.length;
  }
}
