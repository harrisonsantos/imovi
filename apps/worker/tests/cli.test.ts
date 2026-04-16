import { describe, it, expect, vi } from 'vitest';

import { parseArgs, runCli } from '../src/cli.js';
import { silentLogger } from '../src/logger.js';

describe('parseArgs', () => {
  it('parseia scrape --source zap,vivareal --max 100', () => {
    const r = parseArgs(['scrape', '--source', 'zap,vivareal', '--max', '100']);
    expect(r).toEqual({
      command: 'scrape',
      sources: ['zap', 'vivareal'],
      max: 100,
    });
  });

  it('scrape sem --source usa todas as sources', () => {
    const r = parseArgs(['scrape']);
    expect(r.command).toBe('scrape');
    if (r.command === 'scrape') {
      expect(r.sources).toEqual(['zap', 'vivareal', 'olx']);
      expect(r.max).toBeUndefined();
    }
  });

  it('parseia enrich-iptu --limit 50', () => {
    const r = parseArgs(['enrich-iptu', '--limit', '50']);
    expect(r).toEqual({ command: 'enrich-iptu', limit: 50 });
  });

  it('comando desconhecido retorna unknown', () => {
    const r = parseArgs(['voar']);
    expect(r).toEqual({ command: 'unknown', raw: 'voar' });
  });

  it('sem argumentos retorna help', () => {
    expect(parseArgs([]).command).toBe('help');
  });
});

describe('runCli', () => {
  it('scrape válido chama runScrape e exit(0)', async () => {
    const exit = vi.fn();
    const runScrape = vi.fn(async () => {});
    const runEnrichIptu = vi.fn(async () => {});

    const code = await runCli(
      ['scrape', '--source', 'zap', '--max', '10'],
      {
        env: { DATABASE_URL: 'postgres://x' },
        exit,
        logger: silentLogger,
        runScrape,
        runEnrichIptu,
      },
    );

    expect(code).toBe(0);
    expect(exit).toHaveBeenCalledWith(0);
    expect(runScrape).toHaveBeenCalledOnce();
    const args = (runScrape.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(args.sources).toEqual(['zap']);
    expect(args.max).toBe(10);
    expect(args.databaseUrl).toBe('postgres://x');
  });

  it('comando desconhecido → exit(1)', async () => {
    const exit = vi.fn();
    const code = await runCli(['voar'], {
      env: { DATABASE_URL: 'postgres://x' },
      exit,
      logger: silentLogger,
      runScrape: vi.fn(),
      runEnrichIptu: vi.fn(),
    });
    expect(code).toBe(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('sem DATABASE_URL → exit(1)', async () => {
    const exit = vi.fn();
    const code = await runCli(['scrape'], {
      env: {},
      exit,
      logger: silentLogger,
      runScrape: vi.fn(),
      runEnrichIptu: vi.fn(),
    });
    expect(code).toBe(1);
  });

  it('erro dentro do comando → exit(1)', async () => {
    const exit = vi.fn();
    const runScrape = vi.fn(async () => {
      throw new Error('db down');
    });

    const code = await runCli(['scrape'], {
      env: { DATABASE_URL: 'postgres://x' },
      exit,
      logger: silentLogger,
      runScrape,
      runEnrichIptu: vi.fn(),
    });
    expect(code).toBe(1);
  });
});
