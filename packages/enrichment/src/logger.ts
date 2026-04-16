/**
 * Logger mínimo injetável — evita acoplamento com pino/winston no core.
 * Basta fornecer `{ warn, error, info }`; em testes usamos `vi.fn()`.
 */
export interface Logger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

/** Logger default no-op para quando o caller não injeta um. */
export const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};
