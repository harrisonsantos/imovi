import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const webRoot = fileURLToPath(new URL('../', import.meta.url));
const buildEnv = { ...process.env };

// next-on-pages uses bash for package-manager detection. The Windows WSL
// launcher cannot run this Windows Node/pnpm toolchain; use Git Bash instead.
if (process.platform === 'win32') {
  const candidates = [
    ...[process.env.ProgramW6432, process.env.ProgramFiles, process.env['ProgramFiles(x86)']]
      .filter(Boolean)
      .map((directory) => path.join(directory, 'Git', 'bin', 'bash.exe')),
    ...(process.env.LOCALAPPDATA
      ? [path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe')]
      : []),
  ];
  try {
    for (const gitPath of execFileSync('where.exe', ['git'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .split(/\r?\n/)) {
      candidates.push(path.resolve(path.dirname(gitPath), '../bin/bash.exe'));
    }
  } catch {
    // The usual installation locations above also cover Git outside PATH.
  }
  const gitBash = candidates.find((candidate) => existsSync(candidate));
  if (!gitBash) {
    throw new Error(
      'The Windows Pages build requires Git Bash. Install Git for Windows or run this build on Linux.',
    );
  }
  const pathKey = Object.keys(buildEnv).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  buildEnv[pathKey] = `${path.dirname(gitBash)}${path.delimiter}${buildEnv[pathKey] ?? ''}`;
}

// Cloudflare builds use Vercel's local output format only. A public local
// configuration avoids interactive project linking on a fresh checkout.
// Existing Vercel links are preserved; this never creates a cloud project.
const vercelDirectory = path.join(webRoot, '.vercel');
await mkdir(vercelDirectory, { recursive: true });
try {
  await writeFile(
    path.join(vercelDirectory, 'project.json'),
    `${JSON.stringify(
      {
        projectId: 'imovi-web',
        orgId: 'imovi-local',
        settings: { framework: 'nextjs', nodeVersion: '22.x' },
      },
      null,
      2,
    )}\n`,
    { flag: 'wx' },
  );
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}

async function runCli(packageName, cliPath, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: webRoot,
      env: buildEnv,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${packageName} failed (${signal ?? `exit ${code}`})`));
    });
  });
}

const vercelCli = path.join(path.dirname(require.resolve('vercel/package.json')), 'dist/index.js');
const nextOnPagesCli = path.resolve(
  path.dirname(require.resolve('@cloudflare/next-on-pages/next-dev')),
  '../../bin/index.js',
);
await runCli('vercel', vercelCli, ['build', '--yes']);
await runCli('@cloudflare/next-on-pages', nextOnPagesCli, ['--skip-build']);
