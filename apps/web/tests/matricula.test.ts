/**
 * Testes da lógica pura do upload de matrículas:
 *   - validação de mime/tamanho (validateMatriculaFile);
 *   - sanitização do nome de arquivo e formato da chave R2 (buildMatriculaKey).
 *
 * As rotas em si exigem o runtime Cloudflare (R2/formData) e não são testadas
 * aqui — toda a lógica não trivial foi extraída para estas funções puras.
 */
import { describe, it, expect } from 'vitest';
import {
  MATRICULA_ALLOWED_MIMES,
  MATRICULA_MAX_SIZE_BYTES,
  buildMatriculaKey,
  sanitizeFileName,
  validateMatriculaFile,
} from '../src/lib/matricula';

describe('validateMatriculaFile', () => {
  const signatures = [
    ['application/pdf', [0x25, 0x50, 0x44, 0x46, 0x2d]],
    ['image/jpeg', [0xff, 0xd8, 0xff]],
    ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ] as const;

  it.each(signatures)('confere assinatura de %s', (mime, signature) => {
    const bytes = new Uint8Array([...signature, 0, 1]);
    expect(validateMatriculaFile(mime, bytes.length, bytes).ok).toBe(true);
    expect(validateMatriculaFile(mime, 20, new TextEncoder().encode('<html>fake</html>')).ok).toBe(
      false,
    );
    expect(validateMatriculaFile(mime, 1, new Uint8Array(signature.slice(0, -1))).ok).toBe(false);
    expect(validateMatriculaFile(mime, 1, new Uint8Array()).ok).toBe(false);
    for (const [otherMime, otherSignature] of signatures) {
      if (otherMime !== mime) {
        expect(
          validateMatriculaFile(mime, otherSignature.length, new Uint8Array(otherSignature)).ok,
        ).toBe(false);
      }
    }
  });

  it('aceita pdf/jpeg/png dentro do limite', () => {
    for (const mime of MATRICULA_ALLOWED_MIMES) {
      expect(validateMatriculaFile(mime, 1024)).toEqual({ ok: true });
    }
    // Exatamente no limite (10MB) ainda é aceito.
    expect(validateMatriculaFile('application/pdf', MATRICULA_MAX_SIZE_BYTES)).toEqual({
      ok: true,
    });
  });

  it('rejeita mime não permitido', () => {
    for (const mime of ['image/gif', 'text/html', 'application/zip', '']) {
      const r = validateMatriculaFile(mime, 1024);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/PDF|JPEG|PNG/);
    }
  });

  it('rejeita arquivo acima de 10MB', () => {
    const r = validateMatriculaFile('application/pdf', MATRICULA_MAX_SIZE_BYTES + 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/10\s?MB/i);
  });

  it('rejeita arquivo vazio (size 0)', () => {
    expect(validateMatriculaFile('application/pdf', 0).ok).toBe(false);
  });
});

describe('sanitizeFileName', () => {
  it('remove caracteres perigosos e separadores de path', () => {
    expect(sanitizeFileName('../../etc/passwd')).not.toContain('/');
    expect(sanitizeFileName('..\\windows\\system32.pdf')).not.toContain('\\');
    expect(sanitizeFileName('a b#c?.pdf')).toBe('a_b_c_.pdf');
  });

  it('preserva letras, números, ponto, hífen e underscore', () => {
    expect(sanitizeFileName('Matricula_123-final.pdf')).toBe('Matricula_123-final.pdf');
  });

  it('nome vazio após sanitização vira fallback', () => {
    expect(sanitizeFileName('###')).not.toBe('');
    expect(sanitizeFileName('')).not.toBe('');
  });

  it('trunca nomes muito longos', () => {
    expect(sanitizeFileName(`${'a'.repeat(500)}.pdf`).length).toBeLessThanOrEqual(128);
  });
});

describe('buildMatriculaKey', () => {
  const ORG = 'org-1';
  const IMOVEL = '0b9f3c1e-2222-4444-8888-aaaaaaaaaaaa';

  it('formato {orgId}/{imovelId}/{uuid}-{nome sanitizado}', () => {
    const key = buildMatriculaKey(ORG, IMOVEL, 'doc final.pdf', 'fixed-uuid');
    expect(key).toBe(`${ORG}/${IMOVEL}/fixed-uuid-doc_final.pdf`);
  });

  it('gera uuid quando não informado (chaves distintas p/ mesmo arquivo)', () => {
    const a = buildMatriculaKey(ORG, IMOVEL, 'doc.pdf');
    const b = buildMatriculaKey(ORG, IMOVEL, 'doc.pdf');
    expect(a).not.toBe(b);
    expect(a.startsWith(`${ORG}/${IMOVEL}/`)).toBe(true);
    expect(a.endsWith('-doc.pdf')).toBe(true);
  });

  it('nome malicioso não escapa do prefixo da org/imóvel', () => {
    const key = buildMatriculaKey(ORG, IMOVEL, '../../outra-org/doc.pdf', 'u');
    // Só os dois separadores estruturais org/imovel/arquivo.
    expect(key.split('/')).toHaveLength(3);
  });
});
