import { createHash } from 'node:crypto';

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
const toLf = (text: string): string => text.replace(/\r\n/g, '\n');

/** Checksum gravado em schema_migrations: sempre do conteúdo com LF. */
export function migrationChecksum(content: string): string {
  return sha256(toLf(content));
}

/**
 * Compara com o checksum já registrado. Aceita também o hash da versão CRLF do
 * mesmo conteúdo, gravado por execuções antigas a partir de checkout no Windows.
 */
export function checksumMatches(recorded: string, content: string): boolean {
  const lf = toLf(content);
  return recorded === sha256(lf) || recorded === sha256(lf.replace(/\n/g, '\r\n'));
}
