/**
 * Lógica pura do upload de matrículas (testável sem runtime Cloudflare):
 *   - validação de mime/tamanho do arquivo;
 *   - sanitização do nome e construção da chave R2.
 *
 * As rotas edge (/api/auditoria/matricula/*) só orquestram: formData → estas
 * funções → R2 put → repositório.
 */

export const MATRICULA_ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export const MATRICULA_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export type MatriculaFileValidation = { ok: true } | { ok: false; error: string };

/** Valida tipo e tamanho do arquivo de matrícula (limites do produto). */
export function validateMatriculaFile(mime: string, size: number): MatriculaFileValidation {
  if (!(MATRICULA_ALLOWED_MIMES as readonly string[]).includes(mime)) {
    return { ok: false, error: 'Apenas arquivos PDF, JPEG e PNG são permitidos.' };
  }
  if (size <= 0) {
    return { ok: false, error: 'Arquivo vazio.' };
  }
  if (size > MATRICULA_MAX_SIZE_BYTES) {
    return { ok: false, error: 'Arquivo muito grande. Máximo: 10MB.' };
  }
  return { ok: true };
}

const MAX_FILE_NAME_LENGTH = 128;

/**
 * Sanitiza o nome do arquivo para uso na chave R2: só [A-Za-z0-9._-],
 * sem separadores de path (anti path-traversal), com fallback e truncamento.
 */
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._-]+/, '');
  const truncated = cleaned.slice(0, MAX_FILE_NAME_LENGTH);
  return truncated.length > 0 ? truncated : 'arquivo';
}

/**
 * Chave R2 do documento: `{orgId}/{imovelId}/{uuid}-{nome sanitizado}`.
 * O uuid evita colisão entre uploads do mesmo arquivo; injetável p/ teste.
 */
export function buildMatriculaKey(
  orgId: string,
  imovelId: string,
  fileName: string,
  uuid: string = crypto.randomUUID(),
): string {
  return `${orgId}/${imovelId}/${uuid}-${sanitizeFileName(fileName)}`;
}
