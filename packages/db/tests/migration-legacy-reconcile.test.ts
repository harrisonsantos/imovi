import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '../src/migrate.js';
import { migrationChecksum } from '../src/migration-checksum.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

const EXPECTED_MIGRATIONS = [
  '0001_initial.sql',
  '0002_cities.sql',
  '0003_auth.sql',
  '0004_audit.sql',
  '0005_matriculas.sql',
  '0006_billing.sql',
  '0007_stabilization.sql',
  '0008_terms_acceptance.sql',
  '0010_account_anonymization.sql',
  '0011_invitation_created_at.sql',
] as const;

describe('reconciliação de migrations legadas (Gate G1 — imovi-prod sem schema_migrations)', () => {
  it('reconcilia banco com 0001 e 0002 aplicadas manualmente sem schema_migrations, registra 0001..0011 com SHA-256 e é no-op na 2ª execução', async () => {
    const pg = new PGlite();
    await pg.waitReady;

    try {
      // a) Simula imovi-prod: 0001 e 0002 aplicadas manualmente no passado, sem schema_migrations.
      const sql0001 = await readFile(join(MIGRATIONS_DIR, '0001_initial_pglite.sql'), 'utf8');
      const sql0002 = await readFile(join(MIGRATIONS_DIR, '0002_cities_pglite.sql'), 'utf8');
      await pg.exec(sql0001);
      await pg.exec(sql0002);

      // Dados existentes antes da reconciliação (como em imovi-prod).
      const neighborhoodId = '00000000-0000-4000-8000-000000000010';
      const propertyId = '00000000-0000-4000-8000-000000000011';
      const listingId = '00000000-0000-4000-8000-000000000012';
      await pg.query(
        `INSERT INTO neighborhoods (id, city, state, name, median_price_m2, listing_count)
         VALUES ($1, 'Curitiba', 'PR', 'Batel', 12500.00, 42)`,
        [neighborhoodId],
      );
      await pg.query(
        `INSERT INTO properties (id, fingerprint, neighborhood_id, city, state)
         VALUES ($1, 'fp-curitiba-batel-1', $2, 'Curitiba', 'PR')`,
        [propertyId, neighborhoodId],
      );
      await pg.query(
        `INSERT INTO listings (id, property_id, source, source_listing_id, price, operation, scraped_at)
         VALUES ($1, $2, 'zap', 'zap-1', 950000.00, 'sale', '2026-06-11T12:00:00Z')`,
        [listingId, propertyId],
      );
      await pg.query(
        `INSERT INTO listing_snapshots (listing_id, price, captured_at)
         VALUES ($1, 950000.00, '2026-06-11T12:00:00Z')`,
        [listingId],
      );
      await pg.query(
        `INSERT INTO cities (name, state, slug, active)
         VALUES ('Curitiba', 'PR', 'curitiba-pr', true)`,
      );

      const beforeLedger = await pg.query<{ reg: string | null }>(
        `SELECT to_regclass('public.schema_migrations') AS reg`,
      );
      expect(beforeLedger.rows[0]?.reg).toBeNull();

      // b) Executa runMigrations para reconciliar 0001..0002 e aplicar 0003..0008.
      const firstRun = await runMigrations(pg, { pglite: true });
      expect(firstRun.applied).toEqual([...EXPECTED_MIGRATIONS]);
      expect(firstRun.skipped).toEqual([]);

      // c) Verifica que todas as 10 versões ficam registradas com checksum SHA-256 válido.
      const recorded = await pg.query<{ name: string; checksum: string; applied_at: Date }>(
        `SELECT name, checksum, applied_at FROM schema_migrations ORDER BY name`,
      );
      expect(recorded.rows).toHaveLength(EXPECTED_MIGRATIONS.length);

      for (const [idx, file] of EXPECTED_MIGRATIONS.entries()) {
        const content = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
        const expectedChecksum = migrationChecksum(content);
        expect(expectedChecksum).toMatch(/^[a-f0-9]{64}$/);
        expect(recorded.rows[idx]).toMatchObject({
          name: file,
          checksum: expectedChecksum,
        });
        expect(recorded.rows[idx]?.applied_at).toBeTruthy();
      }

      // Dados legados preservados e enriquecidos pela 0007; tabelas de 0003..0008 presentes.
      const citiesCount = await pg.query<{ slug: string }>(`SELECT slug FROM cities`);
      expect(citiesCount.rows).toEqual([{ slug: 'curitiba-pr' }]);

      const snapshotAfter = await pg.query<{ property_id: string | null; operation: string | null }>(
        `SELECT property_id, operation FROM listing_snapshots WHERE listing_id = $1`,
        [listingId],
      );
      expect(snapshotAfter.rows).toEqual([{ property_id: propertyId, operation: 'sale' }]);

      for (const table of [
        'users',
        'organizations',
        'audit_corretores',
        'audit_matriculas',
        'billing_events',
        'waitlist_contacts',
        'api_rate_limits',
        'terms_acceptances',
      ]) {
        const reg = await pg.query<{ reg: string | null }>(
          `SELECT to_regclass($1) AS reg`,
          [`public.${table}`],
        );
        expect(reg.rows[0]?.reg).toBe(table);
      }

      // Segunda execução consecutiva de runMigrations deve ser no-op idempotente.
      const secondRun = await runMigrations(pg, { pglite: true });
      expect(secondRun.applied).toEqual([]);
      expect(secondRun.skipped).toEqual([...EXPECTED_MIGRATIONS]);

      const recordedAfterSecond = await pg.query<{ name: string; checksum: string }>(
        `SELECT name, checksum FROM schema_migrations ORDER BY name`,
      );
      expect(recordedAfterSecond.rows).toEqual(
        recorded.rows.map(({ name, checksum }) => ({ name, checksum })),
      );
    } finally {
      await pg.close();
    }
  });

  it('preserva a mensagem e o código SQLSTATE do erro original ao falhar e faz rollback da migration incompleta', async () => {
    const pg = new PGlite();
    await pg.waitReady;

    try {
      const sql0001 = await readFile(join(MIGRATIONS_DIR, '0001_initial_pglite.sql'), 'utf8');
      const sql0002 = await readFile(join(MIGRATIONS_DIR, '0002_cities_pglite.sql'), 'utf8');
      await pg.exec(sql0001);
      await pg.exec(sql0002);

      // Insere snapshots duplicados em (listing_id, captured_at), o que viola o índice único
      // criado em 0007_stabilization.sql (SQLSTATE 23505 unique_violation).
      const listingId = '00000000-0000-4000-8000-000000000099';
      await pg.query(
        `INSERT INTO listings (id, source, source_listing_id, price, operation, scraped_at)
         VALUES ($1, 'zap', 'dup-1', 500000.00, 'sale', '2026-06-11T12:00:00Z')`,
        [listingId],
      );
      await pg.query(
        `INSERT INTO listing_snapshots (listing_id, price, captured_at)
         VALUES ($1, 500000.00, '2026-06-11T12:00:00Z'), ($1, 510000.00, '2026-06-11T12:00:00Z')`,
        [listingId],
      );

      let caught: (Error & { code?: string }) | undefined;
      try {
        await runMigrations(pg, { pglite: true });
      } catch (err) {
        caught = err as Error & { code?: string };
      }

      expect(caught).toBeInstanceOf(Error);
      expect(caught?.message).toMatch(
        /^Migration failed for 0007_stabilization\.sql: .*listing_snapshots_listing_captured_ux/,
      );
      expect(caught?.message).toContain('23505');
      expect(caught?.code).toBe('23505');

      // 0001..0006 permanecem registradas; 0007 sofreu rollback e 0008 não rodou.
      const recorded = await pg.query<{ name: string }>(
        `SELECT name FROM schema_migrations ORDER BY name`,
      );
      expect(recorded.rows.map((r) => r.name)).toEqual(EXPECTED_MIGRATIONS.slice(0, 6));
    } finally {
      await pg.close();
    }
  });

  it('garante que 0001_initial.sql usa apenas DDL IF NOT EXISTS e que 0002..0008 coincidem com as variantes _pglite', async () => {
    const sql0001 = await readFile(join(MIGRATIONS_DIR, '0001_initial.sql'), 'utf8');
    const createLines = sql0001
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^CREATE\s+(EXTENSION|TABLE|UNIQUE\s+INDEX|INDEX)\b/i.test(line));
    expect(createLines.length).toBeGreaterThan(0);
    for (const line of createLines) {
      expect(line).toMatch(/IF\s+NOT\s+EXISTS/i);
    }

    for (const file of EXPECTED_MIGRATIONS.slice(1)) {
      const prod = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      const pglite = await readFile(
        join(MIGRATIONS_DIR, file.replace(/\.sql$/, '_pglite.sql')),
        'utf8',
      );
      expect(pglite).toBe(prod);
    }
  });
});
