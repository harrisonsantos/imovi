/**
 * Tipo de client aceito pelos repositórios.
 *
 * Usamos o tipo base `PgDatabase` do drizzle para que os repos funcionem com
 * qualquer driver (neon-http em produção, pglite em testes). Cada repo é uma
 * função que recebe o client e retorna métodos específicos.
 */
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from '../schema.js';

export type AnyDbClient = PgDatabase<PgQueryResultHKT, typeof schema>;
