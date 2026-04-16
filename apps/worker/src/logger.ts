/**
 * Logger estruturado minimalista (interface pino-like).
 * Emite JSON linha a linha em stdout para facilitar parsing em pipelines.
 */
export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
}

type Level = 'info' | 'warn' | 'error' | 'debug';

function emit(level: Level, msg: string, meta?: Record<string, unknown>): void {
  const entry = {
    level,
    time: new Date().toISOString(),
    msg,
    ...(meta ?? {}),
  };
  // stdout por padrão; stderr quando erro para separação em shells
  const line = JSON.stringify(entry);
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

/** Logger padrão: console JSON. */
export const consoleLogger: Logger = {
  info: (msg, meta) => emit('info', msg, meta),
  warn: (msg, meta) => emit('warn', msg, meta),
  error: (msg, meta) => emit('error', msg, meta),
  debug: (msg, meta) => emit('debug', msg, meta),
};

/** Logger silencioso — útil em testes. */
export const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};
