import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, type TestDb } from './setup.js';
import { cityRepo } from '../src/repositories/cities.js';

describe('cityRepo', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
    await t.raw.query(
      `INSERT INTO cities (name, state, slug, active, portal_locations) VALUES
       ('Curitiba', 'PR', 'curitiba-pr', true, '{"zap":"pr+curitiba"}'),
       ('Porto Alegre', 'RS', 'porto-alegre-rs', true, '{"zap":"rs+porto-alegre"}'),
       ('São Paulo', 'SP', 'sao-paulo-sp', false, '{}')`,
    );
  });
  afterEach(async () => {
    await t.dispose();
  });

  it('listActive retorna só cidades ativas', async () => {
    const rows = await cityRepo.listActive(t.db);
    expect(rows.map((r) => r.name).sort()).toEqual(['Curitiba', 'Porto Alegre']);
    expect(rows[0]?.portalLocations).toBeDefined();
  });

  it('findByNameState acha cidade (inclusive inativa) e retorna null p/ inexistente', async () => {
    const sp = await cityRepo.findByNameState(t.db, 'São Paulo', 'SP');
    expect(sp?.active).toBe(false);
    const nada = await cityRepo.findByNameState(t.db, 'Recife', 'PE');
    expect(nada).toBeNull();
  });
});
