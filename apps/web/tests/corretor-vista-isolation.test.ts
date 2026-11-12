import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ org: vi.fn(), process: vi.fn() }));
vi.mock('@/lib/cf-env', () => ({ getCfEnv: async () => ({}) }));
vi.mock('@/lib/db', () => ({ getDb: () => ({}) }));
vi.mock('@imovi/db/orgs', () => ({ orgRepo: { findById: mocks.org } }));
vi.mock('@imovi/db/audit', () => ({
  orgVistaConfigRepo: { getByWebhookToken: async () => ({ orgId: 'pro' }) },
}));
vi.mock('@imovi/audit/ingest', () => ({ processVistaEvent: mocks.process }));
import { POST } from '../src/app/api/auditoria/webhooks/vista/[token]/route';
describe('token-authenticated audit routes', () => {
  it('rejects a Pro organization even with a valid legacy Vista webhook token', async () => {
    mocks.org.mockResolvedValue({ id: 'pro', plan: 'corretor_pro', status: 'active' });
    const response = await POST(
      new Request('https://imovi.test/api/auditoria/webhooks/vista/token', {
        method: 'POST',
        body: '{}',
      }),
      { params: Promise.resolve({ token: 'fixture' }) },
    );
    expect(response.status).toBe(403);
    expect(mocks.process).not.toHaveBeenCalled();
  });
});
