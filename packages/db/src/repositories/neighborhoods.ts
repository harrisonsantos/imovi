/**
 * Repositório de neighborhoods (bairros com mediana de preço/m²).
 *
 * `listByCity` alimenta o neighborhood matcher do pipeline de scraping
 * (resolve bairro extraído do addressRaw → neighborhood_id).
 */
import { and, eq } from 'drizzle-orm';
import { neighborhoods } from '../schema.js';
import type { AnyDbClient } from './types.js';

export interface NeighborhoodSummary {
  id: string;
  name: string;
}

export interface NeighborhoodRepo {
  listByCity(db: AnyDbClient, city: string, state: string): Promise<NeighborhoodSummary[]>;
}

export const neighborhoodRepo: NeighborhoodRepo = {
  async listByCity(db, city, state) {
    return await db
      .select({ id: neighborhoods.id, name: neighborhoods.name })
      .from(neighborhoods)
      .where(and(eq(neighborhoods.city, city), eq(neighborhoods.state, state)));
  },
};
