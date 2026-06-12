/**
 * Testes da lógica pura do dashboard de auditoria:
 *   - parsing/validação dos query params (zod) usados pelas rotas edge;
 *   - utilitário de CSV (separador `;`, escape de aspas, BOM p/ Excel pt-BR).
 *
 * As rotas em si exigem o runtime Cloudflare e não são testadas aqui — toda a
 * lógica não trivial foi extraída para estas funções puras.
 */
import { describe, it, expect } from 'vitest';
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
    expect(parseAnomaliasQuery(params('resolvida=false&tipo=desvio_avm&limit=5&offset=10'))).toEqual({
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
    const csv = buildCsv(['Nome', 'Obs'], [
      ['Maria', 'sem obs'],
      ['José; Filho', 'disse "ok"'],
    ]);
    const semBom = csv.slice(1);
    expect(semBom.split('\r\n')).toEqual([
      'Nome;Obs',
      'Maria;sem obs',
      '"José; Filho";"disse ""ok"""',
    ]);
  });
});
