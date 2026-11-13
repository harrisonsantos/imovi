import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Converts Windows junction targets (returned by readlink as absolute paths)
 * into paths relative to the link's parent directory so Next.js standalone
 * and OpenNext copyTracedFiles preserve self-contained relative links.
 */
export function toRelativeLinkTarget(linkPath, targetPath) {
  if (typeof targetPath !== 'string') return targetPath;
  const cleanTarget = targetPath.replace(/^\\\\\?\\/, '').replace(/[\\/]+$/, '');
  if (!path.isAbsolute(cleanTarget)) return targetPath;
  const linkDir = path.dirname(path.resolve(String(linkPath)));
  return path.relative(linkDir, cleanTarget);
}

/**
 * Installs a readlink + symlink junction fallback for Windows environments
 * where creating directory symlinks without Developer Mode fails with EPERM.
 *
 * @param {Pick<typeof fs, 'symlinkSync' | 'readlinkSync'> & { promises: Pick<typeof fs.promises, 'symlink' | 'readlink'> }} [fsLike]
 */
export function installWindowsSymlinkFallback(fsLike = fs) {
  const origReadlink = fsLike.promises.readlink;
  fsLike.promises.readlink = async function (p, options) {
    const res = await origReadlink.call(this, p, options);
    return toRelativeLinkTarget(p, res);
  };

  const origReadlinkSync = fsLike.readlinkSync;
  fsLike.readlinkSync = function (p, options) {
    const res = origReadlinkSync.call(this, p, options);
    return toRelativeLinkTarget(p, res);
  };

  const origSymlink = fsLike.promises.symlink;
  fsLike.promises.symlink = async function (target, dest, type) {
    try {
      return await origSymlink.call(this, target, dest, type);
    } catch (error) {
      if (error && error.code === 'EPERM') {
        const absTarget = path.resolve(path.dirname(path.resolve(String(dest))), String(target));
        return await origSymlink.call(this, absTarget, dest, 'junction');
      }
      throw error;
    }
  };

  const origSymlinkSync = fsLike.symlinkSync;
  fsLike.symlinkSync = function (target, dest, type) {
    try {
      return origSymlinkSync.call(this, target, dest, type);
    } catch (error) {
      if (error && error.code === 'EPERM') {
        const absTarget = path.resolve(path.dirname(path.resolve(String(dest))), String(target));
        return origSymlinkSync.call(this, absTarget, dest, 'junction');
      }
      throw error;
    }
  };

  if (fsLike === fs) {
    syncBuiltinESMExports();
  }
}

export function withWindowsPreloadEnv(
  env,
  scriptUrl = import.meta.url,
  platform = process.platform,
) {
  const nextEnv = { ...env };
  if (platform !== 'win32') return nextEnv;
  const importFlag = `--import=${scriptUrl}`;
  const current = nextEnv.NODE_OPTIONS ?? '';
  if (!current.includes(importFlag)) {
    nextEnv.NODE_OPTIONS = current ? `${current} ${importFlag}` : importFlag;
  }
  nextEnv.IMOVI_WIN_SYMLINK_SHIM = '1';
  return nextEnv;
}

if (process.platform === 'win32' && process.env.IMOVI_WIN_SYMLINK_SHIM === '1') {
  installWindowsSymlinkFallback(fs);
}

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const require = createRequire(import.meta.url);
  const webRoot = fileURLToPath(new URL('../', import.meta.url));
  const openNextCli = path.resolve(
    path.dirname(require.resolve('@opennextjs/cloudflare')),
    '../cli/index.js',
  );
  const buildEnv = withWindowsPreloadEnv(process.env, import.meta.url, process.platform);

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [openNextCli, 'build', ...process.argv.slice(2)], {
      cwd: webRoot,
      env: buildEnv,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`opennextjs-cloudflare build failed (${signal ?? `exit ${code}`})`));
    });
  });
}
