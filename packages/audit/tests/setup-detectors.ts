/**
 * Harness de teste dos detectores: reexporta o helper pglite de packages/db
 * via import relativo (mesmo padrão de packages/db/tests/setup.ts).
 *
 * Nome único de propósito — outro setup pode coexistir neste pacote.
 * O import relativo garante que `drizzle-orm/pglite` resolva a partir de
 * packages/db (dependência declarada lá; @imovi/audit não depende de
 * drizzle-orm diretamente).
 */
export { createTestDb, type TestDb } from '../../db/tests/setup.js';
