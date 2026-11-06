import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

// O db:migrate grava o sha256 de cada arquivo. Se um checkout no Windows
// converter LF para CRLF, a próxima execução acusa "checksum mismatch".
describe('migrations SQL', () => {
  it('usam LF em qualquer checkout (checksum estável no db:migrate)', async () => {
    const dir = new URL('../migrations/', import.meta.url);
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThan(0);
    const withCrlf: string[] = [];
    for (const f of files) {
      if ((await readFile(new URL(f, dir), 'utf8')).includes('\r')) withCrlf.push(f);
    }
    expect(withCrlf).toEqual([]);
  });
});
