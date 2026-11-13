import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { checksumMatches, migrationChecksum } from '../src/migration-checksum.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const lf = 'CREATE TABLE a (id int);\nCREATE TABLE b (id int);\n';
const crlf = lf.replace(/\n/g, '\r\n');

describe('checksum das migrations', () => {
  it('não depende do fim de linha do checkout', () => {
    expect(migrationChecksum(crlf)).toBe(migrationChecksum(lf));
    expect(migrationChecksum(lf)).toBe(sha(lf));
  });

  it('aceita registro antigo feito a partir de checkout LF ou CRLF', () => {
    for (const content of [lf, crlf]) {
      expect(checksumMatches(sha(lf), content)).toBe(true);
      expect(checksumMatches(sha(crlf), content)).toBe(true);
    }
  });

  it('continua acusando mudança real de conteúdo', () => {
    expect(checksumMatches(sha(lf), lf.replace('b', 'c'))).toBe(false);
  });
});
