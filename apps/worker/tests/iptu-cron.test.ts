import { afterEach, describe, expect, it, vi } from 'vitest';
import { KvIptuCache } from '@imovi/enrichment';
import { runEnrichIptuCommand } from '../src/commands/enrich-iptu.js';
import worker, { type Env } from '../src/worker-entrypoint.js';

vi.mock('../src/commands/enrich-iptu.js', () => ({ runEnrichIptuCommand: vi.fn() }));
vi.mock('../src/logger.js', () => ({
  consoleLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
afterEach(() => vi.resetAllMocks());

describe('cron IPTU', () => {
  it('injeta env e binding IPTU_CACHE no comando', async () => {
    vi.mocked(runEnrichIptuCommand).mockResolvedValue();
    let task: Promise<unknown> | undefined;
    const env = {
      DATABASE_URL: 'postgres://sintetico',
      INFOSIMPLES_TOKEN: 'token-sintetico',
      INFOSIMPLES_CURITIBA_ENDPOINT:
        'https://api.infosimples.com/api/v2/consultas/contrato-sintetico',
      IPTU_CACHE: { get: vi.fn(), put: vi.fn() },
    } as unknown as Env;
    await worker.scheduled({ cron: '0 7 * * 1' } as ScheduledController, env, {
      waitUntil: (promise: Promise<unknown>) => {
        task = promise;
      },
    } as ExecutionContext);
    await task;
    expect(runEnrichIptuCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        infoSimples: expect.objectContaining({ getIptu: expect.any(Function) }),
        curitiba: expect.objectContaining({ getIptu: expect.any(Function) }),
        cache: expect.any(KvIptuCache),
      }),
    );
  });

  it('mantém falha do lote como rejeição do cron', async () => {
    vi.mocked(runEnrichIptuCommand).mockRejectedValue(new Error('1 falha no lote'));
    let task: Promise<unknown> | undefined;
    await worker.scheduled(
      { cron: '0 7 * * 1' } as ScheduledController,
      {
        DATABASE_URL: 'postgres://sintetico',
        INFOSIMPLES_TOKEN: 'token-sintetico',
        IPTU_CACHE: {},
      } as unknown as Env,
      {
        waitUntil: (promise: Promise<unknown>) => {
          task = promise;
        },
      } as ExecutionContext,
    );
    await expect(task).rejects.toThrow('1 falha');
  });
});
