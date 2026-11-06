import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return Promise.resolve(/\.(ts|tsx)$/.test(entry.name) ? [path] : []);
    }),
  );
  return nested.flat();
}

describe('OpenNext (Workers, runtime Node)', () => {
  it('nenhuma rota ou página declara runtime edge', async () => {
    const offenders: string[] = [];
    for (const file of await sourceFiles(SRC)) {
      if (/export const runtime\s*=\s*['"]edge['"]/.test(await readFile(file, 'utf8'))) {
        offenders.push(file.slice(SRC.length + 1));
      }
    }
    expect(offenders).toEqual([]);
  });
});
