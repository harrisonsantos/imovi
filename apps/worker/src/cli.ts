#!/usr/bin/env node
import type { ListingSource } from '@imovi/shared';
import { consoleLogger, type Logger } from './logger.js';

/**
 * Resultado do parser de argumentos. Discriminated union por `command`
 * para que o chamador saiba exatamente quais campos estão disponíveis.
 */
export type ParsedArgs =
  | { command: 'scrape'; sources: ListingSource[]; max?: number; pages?: number }
  | { command: 'enrich-iptu'; limit?: number }
  | { command: 'backfill-neighborhoods' }
  | { command: 'aggregate-neighborhoods' }
  | { command: 'help' }
  | { command: 'unknown'; raw: string | undefined };

const VALID_SOURCES: readonly ListingSource[] = ['zap', 'vivareal', 'olx'];

function isValidSource(s: string): s is ListingSource {
  return (VALID_SOURCES as readonly string[]).includes(s);
}

/**
 * Parser minimalista: split em pares `--key value`. Sem deps externas.
 * `argv` aqui é o argv *sem* node/script (apenas o comando e flags).
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;

  if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
    return { command: 'help' };
  }

  // Monta um map simples de flags.
  const flags = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const value = rest[i + 1];
    if (key === undefined || !key.startsWith('--') || value === undefined) {
      continue;
    }
    flags.set(key.slice(2), value);
  }

  if (command === 'scrape') {
    const sourceRaw = flags.get('source');
    const sources = sourceRaw
      ? sourceRaw
          .split(',')
          .map((s) => s.trim())
          .filter(isValidSource)
      : [...VALID_SOURCES];

    const maxRaw = flags.get('max');
    const max = maxRaw !== undefined ? Number.parseInt(maxRaw, 10) : undefined;

    const pagesRaw = flags.get('pages');
    const pages = pagesRaw !== undefined ? Number.parseInt(pagesRaw, 10) : undefined;

    return {
      command: 'scrape',
      sources,
      ...(max !== undefined && !Number.isNaN(max) ? { max } : {}),
      ...(pages !== undefined && !Number.isNaN(pages) ? { pages } : {}),
    };
  }

  if (command === 'backfill-neighborhoods') {
    return { command: 'backfill-neighborhoods' };
  }
  if (command === 'aggregate-neighborhoods') return { command: 'aggregate-neighborhoods' };

  if (command === 'enrich-iptu') {
    const limitRaw = flags.get('limit');
    const limit = limitRaw !== undefined ? Number.parseInt(limitRaw, 10) : undefined;
    return {
      command: 'enrich-iptu',
      ...(limit !== undefined && !Number.isNaN(limit) ? { limit } : {}),
    };
  }

  return { command: 'unknown', raw: command };
}

/**
 * Dependências injetáveis para o CLI — permite testar sem chamar
 * process.exit real nem tocar env/DB.
 */
export interface CliDeps {
  env: Record<string, string | undefined>;
  exit: (code: number) => void;
  logger: Logger;
  runScrape: (opts: {
    sources: ListingSource[];
    max?: number;
    pages?: number;
    databaseUrl: string;
    logger: Logger;
  }) => Promise<void>;
  runEnrichIptu: (opts: { limit?: number; databaseUrl: string; logger: Logger }) => Promise<void>;
  runBackfillNeighborhoods?: (opts: { databaseUrl: string; logger: Logger }) => Promise<unknown>;
  runAggregateNeighborhoods?: (opts: { databaseUrl: string; logger: Logger }) => Promise<unknown>;
}

const HELP_TEXT = `imovi-worker — jobs do Imovi (AVM)

Uso:
  imovi-worker scrape --source zap,vivareal --max 100
  imovi-worker enrich-iptu --limit 50
  imovi-worker backfill-neighborhoods
  imovi-worker aggregate-neighborhoods

Flags:
  --source   Lista separada por vírgula: zap,vivareal,olx (padrão: todas)
  --max      Máximo de anúncios por source
  --limit    Máximo de properties a enriquecer

Env:
  DATABASE_URL   Obrigatório para scrape e enrich-iptu
`;

/** Executa o CLI com deps injetadas. Retorna o exit code que foi sinalizado. */
export async function runCli(argv: string[], deps: CliDeps): Promise<number> {
  const parsed = parseArgs(argv);

  if (parsed.command === 'help') {
    deps.logger.info('cli_help');
    process.stdout.write(HELP_TEXT);
    deps.exit(0);
    return 0;
  }

  if (parsed.command === 'unknown') {
    deps.logger.error('cli_unknown_command', { command: parsed.raw });
    process.stderr.write(`Comando desconhecido: ${parsed.raw ?? '<vazio>'}\n`);
    process.stderr.write(HELP_TEXT);
    deps.exit(1);
    return 1;
  }

  const databaseUrl = deps.env['DATABASE_URL'];
  if (databaseUrl === undefined || databaseUrl === '') {
    deps.logger.error('cli_missing_env', { key: 'DATABASE_URL' });
    deps.exit(1);
    return 1;
  }

  try {
    if (parsed.command === 'scrape') {
      await deps.runScrape({
        sources: parsed.sources,
        ...(parsed.max !== undefined ? { max: parsed.max } : {}),
        ...(parsed.pages !== undefined ? { pages: parsed.pages } : {}),
        databaseUrl,
        logger: deps.logger,
      });
    } else if (parsed.command === 'aggregate-neighborhoods') {
      if (!deps.runAggregateNeighborhoods)
        throw new Error('aggregate-neighborhoods não disponível');
      await deps.runAggregateNeighborhoods({ databaseUrl, logger: deps.logger });
    } else if (parsed.command === 'backfill-neighborhoods') {
      if (!deps.runBackfillNeighborhoods) {
        throw new Error('backfill-neighborhoods não disponível neste entrypoint');
      }
      await deps.runBackfillNeighborhoods({ databaseUrl, logger: deps.logger });
    } else {
      await deps.runEnrichIptu({
        ...(parsed.limit !== undefined ? { limit: parsed.limit } : {}),
        databaseUrl,
        logger: deps.logger,
      });
    }
    deps.exit(0);
    return 0;
  } catch (err) {
    deps.logger.error('cli_command_failed', {
      command: parsed.command,
      error: err instanceof Error ? err.message : String(err),
    });
    deps.exit(1);
    return 1;
  }
}

/**
 * Entrypoint real. Só roda quando o módulo é executado diretamente
 * (evita efeito colateral durante os tests).
 */
// eslint-disable-next-line @typescript-eslint/no-floating-promises
if (
  import.meta.url.startsWith('file:') &&
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
) {
  const { runScrapeCommand } = await import('./commands/scrape.js');
  const { runEnrichIptuCommand } = await import('./commands/enrich-iptu.js');
  const { runAggregateNeighborhoodsCommand } =
    await import('./commands/aggregate-neighborhoods.js');
  const { runBackfillNeighborhoodsCommand } = await import('./commands/backfill-neighborhoods.js');

  await runCli(process.argv.slice(2), {
    env: process.env,
    exit: (code) => process.exit(code),
    logger: consoleLogger,
    runScrape: runScrapeCommand,
    runEnrichIptu: runEnrichIptuCommand,
    runAggregateNeighborhoods: runAggregateNeighborhoodsCommand,
    runBackfillNeighborhoods: runBackfillNeighborhoodsCommand,
  });
}
