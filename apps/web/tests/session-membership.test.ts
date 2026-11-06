import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findByUserAndOrg: vi.fn(),
  findById: vi.fn(),
}));
vi.mock('../src/lib/auth.js', () => ({
  getAuth: () => ({ api: { getSession: mocks.getSession } }),
  AuthConfigurationError: class extends Error {},
}));
vi.mock('../src/lib/db.js', () => ({ getDb: () => ({}) }));
vi.mock('@imovi/db/members', () => ({ memberRepo: { findByUserAndOrg: mocks.findByUserAndOrg } }));
vi.mock('@imovi/db/orgs', () => ({ orgRepo: { findById: mocks.findById } }));
import {
  requireOrgIdentity,
  requireOrgAdminIdentity,
  requireOrgAdmin,
} from '../src/lib/session.js';
const request = new Request('https://imovi.test/api');
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    user: { id: 'user', email: 'user@example.com', emailVerified: true },
    session: { activeOrganizationId: 'org-a' },
  });
  mocks.findByUserAndOrg.mockResolvedValue({ role: 'member' });
  mocks.findById.mockResolvedValue({ id: 'org-a', status: 'active', trialEndsAt: null });
});
afterEach(() => vi.unstubAllEnvs());
describe('organization guards', () => {
  it('checks user and active organization against current membership on every request', async () => {
    expect((await requireOrgIdentity(request)).org.id).toBe('org-a');
    expect(mocks.findByUserAndOrg).toHaveBeenCalledWith({}, 'user', 'org-a');
    mocks.findByUserAndOrg.mockResolvedValue(null);
    await expect(requireOrgIdentity(request)).rejects.toMatchObject({
      status: 403,
      code: 'membership_required',
    });
  });
  it('denies member admin actions but accepts admin and owner', async () => {
    await expect(requireOrgAdminIdentity(request)).rejects.toMatchObject({
      status: 403,
      code: 'admin_required',
    });
    for (const role of ['owner', 'admin']) {
      mocks.findByUserAndOrg.mockResolvedValue({ role });
      expect((await requireOrgAdminIdentity(request)).role).toBe(role);
    }
  });
  it('allows suspended admins to access billing but not configuration', async () => {
    mocks.findByUserAndOrg.mockResolvedValue({ role: 'owner' });
    mocks.findById.mockResolvedValue({ id: 'org-a', status: 'suspended', trialEndsAt: null });
    await expect(requireOrgAdminIdentity(request)).resolves.toMatchObject({ org: { id: 'org-a' } });
    await expect(requireOrgAdmin(request)).rejects.toMatchObject({ code: 'subscription_required' });
  });
  it('does not accept an invalid session', async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireOrgIdentity(request)).rejects.toMatchObject({ status: 401 });
    expect(mocks.findByUserAndOrg).not.toHaveBeenCalled();
  });
  it('denies unverified email in production even with a previous session', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    mocks.getSession.mockResolvedValue({
      user: { id: 'user', email: 'user@example.com', emailVerified: false },
      session: { activeOrganizationId: 'org-a' },
    });
    await expect(requireOrgIdentity(request)).rejects.toMatchObject({
      status: 403,
      code: 'email_unverified',
    });
    expect(mocks.findByUserAndOrg).not.toHaveBeenCalled();
  });
});
