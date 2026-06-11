/**
 * Repositório de cities (cidades cobertas pelo Imovi).
 *
 * `listActive` alimenta o loop multi-cidade do pipeline de scraping e a
 * validação de cobertura das APIs.
 */
import { and, eq } from 'drizzle-orm';
import { cities, type City } from '../schema.js';
import type { AnyDbClient } from './types.js';

/** Strings de location por portal (interpoladas direto na URL pelos adapters). */
export interface PortalLocations {
  zap?: string;
  vivareal?: string;
  olx?: string;
}

export interface CityRepo {
  listActive(db: AnyDbClient): Promise<City[]>;
  findByNameState(db: AnyDbClient, name: string, state: string): Promise<City | null>;
}

export const cityRepo: CityRepo = {
  async listActive(db) {
    return await db.select().from(cities).where(eq(cities.active, true));
  },

  async findByNameState(db, name, state) {
    const rows = await db
      .select()
      .from(cities)
      .where(and(eq(cities.name, name), eq(cities.state, state)))
      .limit(1);
    return rows[0] ?? null;
  },
};
