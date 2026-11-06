import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ execute: vi.fn(), scrape: vi.fn() }));
vi.mock('@imovi/db', () => ({ createDbClient: () => ({ execute: mocks.execute }) }));
vi.mock('../src/commands/scrape.js', () => ({ runScrapeCommand: mocks.scrape }));
vi.mock('../src/commands/enrich-iptu.js', () => ({ runEnrichIptuCommand: vi.fn() }));
vi.mock('../src/commands/daily-audit.js', () => ({
  runDailyAuditCommand: vi.fn(),
  DEFAULT_EMAIL_FROM: 'test@example.com',
}));
vi.mock('../src/logger.js', () => ({
  consoleLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
import worker, { type Env } from '../src/worker-entrypoint.js';

const env = { DATABASE_URL: 'postgres://test' } as Env;
describe('Worker health and scheduled failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('liveness does not depend on database availability', async () => {
    mocks.execute.mockRejectedValue(new Error('outage'));
    const response = await worker.fetch(new Request('https://worker.test/health'), env);
    expect(response.status).toBe(200);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('readiness returns unavailable without leaking provider errors', async () => {
    mocks.execute.mockRejectedValue(new Error('secret connection detail'));
    const response = await worker.fetch(new Request('https://worker.test/ready'), env);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable', db: 'unavailable' });
  });
  it('readiness requires a successful database query', async () => {
    mocks.execute.mockResolvedValue([]);
    expect((await worker.fetch(new Request('https://worker.test/ready'), env)).status).toBe(200);
    expect(mocks.execute).toHaveBeenCalledOnce();
  });
  it('failed scrape remains a rejected scheduled task', async () => {
    mocks.scrape.mockRejectedValue(new Error('source empty'));
    let task: Promise<unknown> | undefined;
    const context = {
      waitUntil: (promise: Promise<unknown>) => {
        task = promise;
      },
    } as ExecutionContext;
    await worker.scheduled({ cron: '0 6 * * *' } as ScheduledController, env, context);
    await expect(task).rejects.toThrow('source empty');
  });
});
