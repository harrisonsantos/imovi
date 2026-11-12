import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  parseRobotsTxt,
  fetchRobotsPolicy,
  clearRobotsPolicyCache,
} from '../src/core/robots.js';

describe('parseRobotsTxt', () => {
  beforeEach(() => {
    clearRobotsPolicyCache();
  });

  it('permite tudo quando robots.txt vazio', () => {
    const policy = parseRobotsTxt('');
    expect(policy.isAllowed('ImoviBR-Bot', '/qualquer/caminho')).toBe(true);
  });

  it('respeita Disallow global (User-agent: *)', () => {
    const txt = `User-agent: *\nDisallow: /private`;
    const policy = parseRobotsTxt(txt);
    expect(policy.isAllowed('ImoviBR-Bot', '/private/x')).toBe(false);
    expect(policy.isAllowed('ImoviBR-Bot', '/public/x')).toBe(true);
  });

  it('Allow mais específico sobrepõe Disallow', () => {
    const txt = `User-agent: *\nDisallow: /a\nAllow: /a/public`;
    const policy = parseRobotsTxt(txt);
    expect(policy.isAllowed('ImoviBR-Bot', '/a/private')).toBe(false);
    expect(policy.isAllowed('ImoviBR-Bot', '/a/public/x')).toBe(true);
  });

  it('grupo de user-agent específico tem prioridade sobre o coringa', () => {
    const txt = `User-agent: *\nDisallow: /\n\nUser-agent: ImoviBR-Bot\nDisallow: /blocked\nAllow: /`;
    const policy = parseRobotsTxt(txt);
    expect(policy.isAllowed('ImoviBR-Bot', '/ok')).toBe(true);
    expect(policy.isAllowed('ImoviBR-Bot', '/blocked/x')).toBe(false);
    // Outro bot cai no coringa
    expect(policy.isAllowed('OtherBot', '/ok')).toBe(false);
  });

  it('match de user-agent é case-insensitive e por prefixo', () => {
    const txt = `User-agent: imovibr\nDisallow: /x`;
    const policy = parseRobotsTxt(txt);
    expect(policy.isAllowed('ImoviBR-Bot/1.0', '/x/y')).toBe(false);
  });

  it('ignora linhas de comentário e em branco', () => {
    const txt = `# comentário\n  \nUser-agent: *\n# outro\nDisallow: /z\n`;
    const policy = parseRobotsTxt(txt);
    expect(policy.isAllowed('ImoviBR-Bot', '/z/y')).toBe(false);
  });

  it('Disallow vazio significa "permite tudo"', () => {
    const txt = `User-agent: *\nDisallow:`;
    const policy = parseRobotsTxt(txt);
    expect(policy.isAllowed('ImoviBR-Bot', '/x')).toBe(true);
  });

  it('usa regra mais longa (specificity) entre Allow e Disallow conflitantes', () => {
    const txt = `User-agent: *\nAllow: /a/b\nDisallow: /a`;
    const policy = parseRobotsTxt(txt);
    // `/a/b/c` → Allow(/a/b) tem 4 chars, Disallow(/a) tem 2. Allow vence.
    expect(policy.isAllowed('ImoviBR-Bot', '/a/b/c')).toBe(true);
    expect(policy.isAllowed('ImoviBR-Bot', '/a/x')).toBe(false);
  });

  it('suporta wildcards * e âncora $ conforme RFC 9309 §2.2.3', () => {
    const txt = [
      'User-agent: *',
      'Disallow: /*?*onde=*',
      'Disallow: /relatorios/*.pdf$',
      'Allow: /relatorios/publico.pdf$',
    ].join('\n');
    const policy = parseRobotsTxt(txt);

    expect(policy.isAllowed('ImoviBR-Bot', '/venda/imoveis/pr+curitiba/?pagina=1')).toBe(true);
    expect(policy.isAllowed('ImoviBR-Bot', '/busca?transacao=venda&onde=curitiba')).toBe(false);
    expect(policy.isAllowed('ImoviBR-Bot', '/relatorios/secreto.pdf')).toBe(false);
    expect(policy.isAllowed('ImoviBR-Bot', '/relatorios/secreto.pdf?download=1')).toBe(true);
    expect(policy.isAllowed('ImoviBR-Bot', '/relatorios/publico.pdf')).toBe(true);
  });

  it('cacheia fetchRobotsPolicy por host evitando requisições repetidas ao /robots.txt', async () => {
    const fetchMock = vi.fn(
      async () => new Response('User-agent: *\nDisallow: /admin', { status: 200 }),
    );

    const p1 = await fetchRobotsPolicy('www.zapimoveis.com.br', fetchMock as unknown as typeof fetch);
    const p2 = await fetchRobotsPolicy('www.zapimoveis.com.br', fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(p1.isAllowed('ImoviBR-Bot', '/admin/painel')).toBe(false);
    expect(p2.isAllowed('ImoviBR-Bot', '/venda/imoveis')).toBe(true);
  });
});
