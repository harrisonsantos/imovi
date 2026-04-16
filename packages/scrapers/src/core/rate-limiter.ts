/**
 * Rate limiter por host. Garante um intervalo mínimo entre aquisições
 * consecutivas do mesmo host, permitindo paralelismo entre hosts diferentes.
 *
 * Uso:
 *   const rl = new RateLimiter({ minIntervalMs: 1000 });
 *   await rl.acquire('zapimoveis.com.br'); // resolve imediato (primeira)
 *   await rl.acquire('zapimoveis.com.br'); // espera >=1s desde a anterior
 */
export interface RateLimiterOptions {
  /** Intervalo mínimo em ms entre aquisições consecutivas ao mesmo host. */
  minIntervalMs: number;
}

export class RateLimiter {
  private readonly minIntervalMs: number;
  /**
   * Promessa que representa a conclusão da fila atual para o host.
   * A próxima aquisição encadeia nesta promessa e depois espera
   * minIntervalMs desde a aquisição imediatamente anterior.
   */
  private readonly queue = new Map<string, Promise<void>>();

  constructor(opts: RateLimiterOptions) {
    this.minIntervalMs = opts.minIntervalMs;
  }

  /**
   * Adquire um slot para o host. Resolve quando é seguro prosseguir.
   * A implementação serializa aquisições por host: cada aquisição, ao
   * resolver, agenda o desbloqueio da próxima após minIntervalMs.
   */
  acquire(host: string): Promise<void> {
    const previous = this.queue.get(host) ?? Promise.resolve();

    // Esta aquisição resolve assim que a anterior tiver "liberado" (passado
    // minIntervalMs desde sua resolução).
    const myTurn = previous;

    // A próxima aquisição enfileirada deve esperar minIntervalMs desde o
    // momento em que ESTA aquisição resolve.
    const releaseNext = myTurn.then(
      () => new Promise<void>((resolve) => setTimeout(resolve, this.minIntervalMs)),
    );
    this.queue.set(host, releaseNext);

    return myTurn;
  }
}
