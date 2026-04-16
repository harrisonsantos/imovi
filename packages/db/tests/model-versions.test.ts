import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, type TestDb } from './setup.js';
import { modelVersionRepo } from '../src/repositories/model-versions.js';

describe('modelVersionRepo.setActive', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.dispose();
  });

  it('desativa as outras versões e marca a escolhida como active=true', async () => {
    await modelVersionRepo.register(t.db, { version: 'v1.0.0' });
    await modelVersionRepo.register(t.db, { version: 'v1.1.0' });
    await modelVersionRepo.register(t.db, { version: 'v1.2.0' });

    await modelVersionRepo.setActive(t.db, 'v1.0.0');

    let active = await modelVersionRepo.getActive(t.db);
    expect(active?.version).toBe('v1.0.0');

    await modelVersionRepo.setActive(t.db, 'v1.2.0');
    active = await modelVersionRepo.getActive(t.db);
    expect(active?.version).toBe('v1.2.0');

    const all = await t.raw.query<{ version: string; active: boolean }>(
      'SELECT version, active FROM model_versions ORDER BY version',
    );
    const byVersion = Object.fromEntries(all.rows.map((r) => [r.version, r.active]));
    expect(byVersion).toEqual({ 'v1.0.0': false, 'v1.1.0': false, 'v1.2.0': true });
  });
});
