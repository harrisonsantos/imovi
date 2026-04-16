/**
 * Repositório de versões do modelo de estimativa.
 *
 * `setActive(version)` é atômico: desativa TODAS as demais versões e marca a
 * versão informada como ativa. Quando o registro não existe, cria com
 * active=true.
 */
import { eq, ne } from 'drizzle-orm';
import { modelVersions, type ModelVersion, type NewModelVersion } from '../schema.js';
import type { AnyDbClient } from './types.js';

export interface ModelVersionRepo {
  register(db: AnyDbClient, row: NewModelVersion): Promise<ModelVersion>;
  setActive(db: AnyDbClient, version: string): Promise<ModelVersion>;
  getActive(db: AnyDbClient): Promise<ModelVersion | null>;
}

export const modelVersionRepo: ModelVersionRepo = {
  async register(db, row) {
    const [inserted] = await db
      .insert(modelVersions)
      .values(row)
      .onConflictDoUpdate({
        target: modelVersions.version,
        set: {
          trainedAt: row.trainedAt ?? null,
          trainingRows: row.trainingRows ?? null,
          metrics: row.metrics ?? null,
          artifactUrl: row.artifactUrl ?? null,
          notes: row.notes ?? null,
        },
      })
      .returning();
    if (!inserted) throw new Error('modelVersionRepo.register: insert returned no row');
    return inserted;
  },

  async setActive(db, version) {
    // Desativa todas as outras versões.
    await db.update(modelVersions).set({ active: false }).where(ne(modelVersions.version, version));

    // Garante que a versão alvo exista e fica ativa.
    const [updated] = await db
      .update(modelVersions)
      .set({ active: true })
      .where(eq(modelVersions.version, version))
      .returning();

    if (updated) return updated;

    // Não existia: cria já ativa.
    const [inserted] = await db
      .insert(modelVersions)
      .values({ version, active: true })
      .returning();
    if (!inserted) throw new Error('modelVersionRepo.setActive: insert returned no row');
    return inserted;
  },

  async getActive(db) {
    const rows = await db
      .select()
      .from(modelVersions)
      .where(eq(modelVersions.active, true))
      .limit(1);
    return rows[0] ?? null;
  },
};
