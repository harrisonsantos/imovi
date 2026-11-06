import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  installWindowsSymlinkFallback,
  toRelativeLinkTarget,
  withWindowsPreloadEnv,
} from '../scripts/build-cf.mjs';

describe('OpenNext Windows build compatibility', () => {
  it('converts absolute Windows junction targets to relative symlink targets', () => {
    // Caminhos absolutos da plataforma atual: o teste roda no Windows e no CI Linux.
    const repo = path.resolve('repo');
    const linkPath = path.join(repo, 'apps', 'web', 'node_modules', 'next');
    const target = path.join(repo, 'node_modules', '.pnpm', 'next@15.5.29', 'node_modules', 'next');
    // No Windows, readlink de junction devolve o prefixo \\?\ e barra final.
    const junctionTarget = (process.platform === 'win32' ? '\\\\?\\' : '') + target + path.sep;

    const rel = toRelativeLinkTarget(linkPath, junctionTarget);
    expect(path.isAbsolute(rel)).toBe(false);
    expect(path.resolve(path.dirname(linkPath), rel)).toBe(target);
    expect(toRelativeLinkTarget(linkPath, '../.pnpm/react')).toBe('../.pnpm/react');
  });

  it('falls back to directory junctions when symlink creation fails with EPERM', async () => {
    const symlinkAsync = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('EPERM'), { code: 'EPERM' }))
      .mockResolvedValueOnce(undefined);
    const symlinkSync = vi
      .fn()
      .mockImplementationOnce(() => {
        throw Object.assign(new Error('EPERM'), { code: 'EPERM' });
      })
      .mockReturnValueOnce(undefined);
    const readlinkAsync = vi
      .fn()
      .mockResolvedValue(path.resolve('apps', 'web', '.next', 'standalone', 'node_modules', 'pkg'));
    const readlinkSync = vi
      .fn()
      .mockReturnValue(path.resolve('apps', 'web', '.next', 'standalone', 'node_modules', 'pkg'));

    const fsLike = {
      promises: {
        symlink: symlinkAsync,
        readlink: readlinkAsync,
      },
      symlinkSync,
      readlinkSync,
    };

    installWindowsSymlinkFallback(fsLike);

    const dest = path.resolve(
      'apps',
      'web',
      '.next',
      'standalone',
      'apps',
      'web',
      'node_modules',
      'pkg',
    );
    await fsLike.promises.symlink('../../../node_modules/pkg', dest);
    expect(symlinkAsync).toHaveBeenNthCalledWith(
      2,
      path.resolve('apps', 'web', '.next', 'standalone', 'node_modules', 'pkg'),
      dest,
      'junction',
    );

    fsLike.symlinkSync('../../../node_modules/pkg', dest);
    expect(symlinkSync).toHaveBeenNthCalledWith(
      2,
      path.resolve('apps', 'web', '.next', 'standalone', 'node_modules', 'pkg'),
      dest,
      'junction',
    );

    expect(path.isAbsolute(await fsLike.promises.readlink(dest))).toBe(false);
    expect(path.isAbsolute(fsLike.readlinkSync(dest))).toBe(false);
  });

  it('injects NODE_OPTIONS preload only on win32 without duplicating flags', () => {
    const scriptUrl = 'file:///C:/repo/apps/web/scripts/build-cf.mjs';
    const linuxEnv = withWindowsPreloadEnv(
      { NODE_OPTIONS: '--max-old-space-size=4096' },
      scriptUrl,
      'linux',
    );
    expect(linuxEnv.NODE_OPTIONS).toBe('--max-old-space-size=4096');
    expect(linuxEnv.IMOVI_WIN_SYMLINK_SHIM).toBeUndefined();

    const winEnv = withWindowsPreloadEnv(
      { NODE_OPTIONS: '--max-old-space-size=4096' },
      scriptUrl,
      'win32',
    );
    expect(winEnv.IMOVI_WIN_SYMLINK_SHIM).toBe('1');
    expect(winEnv.NODE_OPTIONS).toContain('--max-old-space-size=4096');
    expect(winEnv.NODE_OPTIONS).toContain(`--import=${scriptUrl}`);

    const idempotent = withWindowsPreloadEnv(winEnv, scriptUrl, 'win32');
    expect(idempotent.NODE_OPTIONS).toBe(winEnv.NODE_OPTIONS);
  });
});
