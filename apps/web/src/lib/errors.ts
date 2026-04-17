/**
 * Formato padronizado de erro para todos os endpoints.
 * Sempre `{ error, message, details? }`.
 */
export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

export function apiError(
  status: number,
  error: string,
  message: string,
  details?: unknown,
): Response {
  const body: ApiError = { error, message, ...(details !== undefined ? { details } : {}) };
  return Response.json(body, { status });
}
