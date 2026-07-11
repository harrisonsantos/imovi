/**
 * Re-export dos operadores drizzle-orm da MESMA instância usada pelo pacote.
 *
 * Apps edge (web) devem importar daqui em vez de 'drizzle-orm' direto:
 * com múltiplas versões/peer-hashes no pnpm, um import bare pode resolver
 * para outra instância e quebrar a tipagem nominal (SQL<unknown> etc.).
 */
export { eq, and, or, asc, desc, sql, isNull, lt, gt, gte, lte, inArray, max, count } from 'drizzle-orm';
