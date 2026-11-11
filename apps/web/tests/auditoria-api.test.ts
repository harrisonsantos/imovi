/**
 * Testes da lógica pura do dashboard de auditoria:
 *   - parsing/validação dos query params (zod) usados pelas rotas edge;
 *   - utilitário de CSV (separador `;`, escape de aspas, BOM p/ Excel pt-BR).
 *
 * As mutações são exercitadas com sessão, repositórios e R2 isolados.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  requireOrg: vi.fn(),
  findImovel: vi.fn(),
  insert: vi.fn(),
  findMatricula: vi.fn(),
  setChecked: vi.fn(),
  setVerified: vi.fn(),
  resolve: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('@/lib/cf-env', () => ({
  getCfEnv: async () => ({ NEXT_PUBLIC_APP_URL: 'http://localhost:3000', MATRICULAS: mocks }),
  authEnvOf: () => ({}),
}));
vi.mock('@/lib/db', () => ({ getDb: () => ({}) }));
vi.mock('@/lib/session', () => ({
  requireOrg: mocks.requireOrg,
  sessionGuard: () => Response.json({ error: 'Unauthorized' }, { status: 401 }),
}));
vi.mock('@imovi/db/audit', () => ({
  auditImoveisRepo: { findById: mocks.findImovel, setMatriculaVerificada: mocks.setVerified },
  auditMatriculasRepo: {
    insert: mocks.insert,
    findById: mocks.findMatricula,
    setChecked: mocks.setChecked,
  },
  auditAnomaliasRepo: { resolve: mocks.resolve },
}));
import { POST as upload } from '../src/app/api/auditoria/matricula/upload/route';
import { POST as check } from '../src/app/api/auditoria/matricula/check/route';
import { PATCH as resolve } from '../src/app/api/auditoria/anomalias/route';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parseAnomaliasQuery,
  parseBooleanParam,
  parseLeadsQuery,
  parsePagination,
  parseStringParam,
} from '../src/lib/auditoria-query';
import { buildCsv, csvEscape, CSV_BOM, CSV_SEPARATOR } from '../src/lib/csv';

const params = (qs: string) => new URLSearchParams(qs);

const id = '0b9f3c1e-2222-4444-8888-aaaaaaaaaaaa';
function mutationRequest(
  path: string,
  method: string,
  origin: string | undefined = 'http://localhost:3000',
) {
  const headers: Record<string, string> = origin === undefined ? {} : { origin };
  return new Request(`http://localhost:3000/api/auditoria/${path}`, {
    method,
    headers,
    body: JSON.stringify({ id }),
  });
}
function uploadRequest(
  content = new TextEncoder().encode('%PDF-1.7 fixture'),
  mime = 'application/pdf',
) {
  const body = new FormData();
  body.set('imovelId', id);
  body.set('file', new File([content], 'matricula.pdf', { type: mime }));
  return new Request('http://localhost:3000/api/auditoria/matricula/upload', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000' },
    body,
  });
}

describe('mutações autenticadas de auditoria', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireOrg.mockResolvedValue({ org: { id: 'org-a' }, userId: 'user-a' });
    mocks.findImovel.mockResolvedValue({ id });
    mocks.findMatricula.mockResolvedValue({ id, imovelId: id });
    mocks.insert.mockImplementation(async (_db, _org, row) => ({ id, ...row }));
    mocks.delete.mockResolvedValue(undefined);
  });

  for (const [path, method, handler] of [
    ['matricula/upload', 'POST', upload],
    ['matricula/check', 'POST', check],
    ['anomalias', 'PATCH', resolve],
  ] as const) {
    it.each([undefined, 'null', 'https://evil.test', 'http://localhost:3001'])(
      `${method} ${path} rejeita origin %s antes de efeitos`,
      async (origin) => {
        const req = mutationRequest(path, method);
        if (origin === undefined) req.headers.delete('origin');
        else req.headers.set('origin', origin);
        const response = await handler(req);
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ error: 'Invalid origin' });
        for (const name of [
          'requireOrg',
          'put',
          'insert',
          'setChecked',
          'setVerified',
          'resolve',
        ] as const) {
          expect(mocks[name]).not.toHaveBeenCalled();
        }
      },
    );

    it(`${method} ${path} mantém exigência de sessão`, async () => {
      mocks.requireOrg.mockRejectedValue(new Error('unauthorized'));
      expect((await handler(mutationRequest(path, method))).status).toBe(401);
      expect(mocks.put).not.toHaveBeenCalled();
    });
  }

  it('aceita check e PATCH com origin correto e mantém org no repositório', async () => {
    expect((await check(mutationRequest('matricula/check', 'POST'))).status).toBe(200);
    expect(mocks.setChecked).toHaveBeenCalledWith({}, 'org-a', id, expect.any(Object));
    expect((await resolve(mutationRequest('anomalias', 'PATCH'))).status).toBe(200);
    expect(mocks.resolve).toHaveBeenCalledWith({}, 'org-a', id);
  });

  it('grava PDF válido e mantém metadados e prefixo da org', async () => {
    const response = await upload(uploadRequest());
    expect(response.status).toBe(200);
    const row = (await response.json()) as { id: string; r2Key: string };
    expect(row.r2Key).toMatch(new RegExp(`^org-a/${id}/`));
    expect(mocks.put).toHaveBeenCalledWith(row.r2Key, expect.anything(), {
      httpMetadata: { contentType: 'application/pdf' },
    });
    expect(mocks.insert).toHaveBeenCalledWith(
      {},
      'org-a',
      expect.objectContaining({ r2Key: row.r2Key, uploadedBy: 'user-a' }),
    );
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it.each(['application/pdf', 'image/jpeg', 'image/png'])(
    'rejeita conteúdo disfarçado de %s antes de R2/DB',
    async (mime) => {
      expect(
        (await upload(uploadRequest(new TextEncoder().encode('<html>fake</html>'), mime))).status,
      ).toBe(400);
      expect(mocks.put).not.toHaveBeenCalled();
      expect(mocks.insert).not.toHaveBeenCalled();
    },
  );

  it('não grava documento para imóvel fora da org', async () => {
    mocks.findImovel.mockResolvedValue(null);
    expect((await upload(uploadRequest())).status).toBe(404);
    expect(mocks.findImovel).toHaveBeenCalledWith({}, 'org-a', id);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'remove objeto órfão preservando erro original (delete falha: %s)',
    async (deleteFails) => {
      const error = new Error('insert failed');
      mocks.insert.mockRejectedValue(error);
      if (deleteFails) mocks.delete.mockRejectedValue(new Error('delete failed'));
      await expect(upload(uploadRequest())).rejects.toBe(error);
      expect(mocks.delete).toHaveBeenCalledExactlyOnceWith(mocks.put.mock.calls[0]![0]);
      expect(mocks.delete.mock.invocationCallOrder[0]).toBeGreaterThan(
        mocks.insert.mock.invocationCallOrder[0]!,
      );
    },
  );

  it('não insere metadados se o put falha', async () => {
    mocks.put.mockRejectedValue(new Error('put failed'));
    await expect(upload(uploadRequest())).rejects.toThrow('put failed');
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});

describe('parsePagination', () => {
  it('aplica defaults quando ausentes', () => {
    expect(parsePagination(params(''))).toEqual({ limit: DEFAULT_LIMIT, offset: 0 });
  });

  it('lê limit/offset válidos', () => {
    expect(parsePagination(params('limit=10&offset=30'))).toEqual({ limit: 10, offset: 30 });
  });

  it('valores inválidos caem no default (não explodem)', () => {
    expect(parsePagination(params('limit=abc&offset=-5'))).toEqual({
      limit: DEFAULT_LIMIT,
      offset: 0,
    });
    expect(parsePagination(params('limit=0'))).toEqual({ limit: DEFAULT_LIMIT, offset: 0 });
    expect(parsePagination(params('limit=2.5'))).toEqual({ limit: DEFAULT_LIMIT, offset: 0 });
  });

  it('limit acima do máximo cai no default', () => {
    expect(parsePagination(params(`limit=${MAX_LIMIT + 1}`)).limit).toBe(DEFAULT_LIMIT);
    expect(parsePagination(params(`limit=${MAX_LIMIT}`)).limit).toBe(MAX_LIMIT);
  });
});

describe('parseBooleanParam / parseStringParam', () => {
  it("boolean: só 'true'/'false' contam; resto → undefined", () => {
    expect(parseBooleanParam(params('resolvida=true'), 'resolvida')).toBe(true);
    expect(parseBooleanParam(params('resolvida=false'), 'resolvida')).toBe(false);
    expect(parseBooleanParam(params('resolvida=1'), 'resolvida')).toBeUndefined();
    expect(parseBooleanParam(params(''), 'resolvida')).toBeUndefined();
  });

  it('string: trim aplicado; vazia/ausente → undefined', () => {
    expect(parseStringParam(params('tipo=%20desvio_avm%20'), 'tipo')).toBe('desvio_avm');
    expect(parseStringParam(params('tipo='), 'tipo')).toBeUndefined();
    expect(parseStringParam(params(''), 'tipo')).toBeUndefined();
  });
});

describe('parseAnomaliasQuery / parseLeadsQuery', () => {
  it('combina filtros e paginação das anomalias', () => {
    expect(
      parseAnomaliasQuery(params('resolvida=false&tipo=desvio_avm&limit=5&offset=10')),
    ).toEqual({
      resolvida: false,
      tipo: 'desvio_avm',
      limit: 5,
      offset: 10,
    });
  });

  it('sem filtros → undefined (lista tudo)', () => {
    const q = parseAnomaliasQuery(params(''));
    expect(q.resolvida).toBeUndefined();
    expect(q.tipo).toBeUndefined();
  });

  it('leads: status + paginação', () => {
    expect(parseLeadsQuery(params('status=novo&limit=15'))).toEqual({
      status: 'novo',
      limit: 15,
      offset: 0,
    });
  });
});

describe('csv (padrão Excel pt-BR)', () => {
  it('usa separador ; e termina células nulas como vazias', () => {
    const csv = buildCsv(['A', 'B'], [['x', null]]);
    expect(csv).toContain('A;B');
    expect(csv).toContain('x;');
    expect(CSV_SEPARATOR).toBe(';');
  });

  it('começa com BOM UTF-8 para o Excel pt-BR', () => {
    const csv = buildCsv(['A'], []);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(CSV_BOM).toHaveLength(1);
    expect(CSV_BOM.charCodeAt(0)).toBe(0xfeff);
  });

  it('escapa células com separador, aspas e quebras de linha', () => {
    expect(csvEscape('a;b')).toBe('"a;b"');
    expect(csvEscape('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvEscape('linha1\nlinha2')).toBe('"linha1\nlinha2"');
    expect(csvEscape('simples')).toBe('simples');
    expect(csvEscape(123.45)).toBe('123.45');
    expect(csvEscape(undefined)).toBe('');
  });

  it('monta linhas com CRLF e escapa só o necessário', () => {
    const csv = buildCsv(
      ['Nome', 'Obs'],
      [
        ['Maria', 'sem obs'],
        ['José; Filho', 'disse "ok"'],
      ],
    );
    const semBom = csv.slice(1);
    expect(semBom.split('\r\n')).toEqual([
      'Nome;Obs',
      'Maria;sem obs',
      '"José; Filho";"disse ""ok"""',
    ]);
  });
});
