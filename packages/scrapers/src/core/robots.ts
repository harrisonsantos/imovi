/**
 * Parser de robots.txt (RFC 9309).
 *
 * Suporta:
 *   - User-agent: <nome>  (case-insensitive, match por prefixo)
 *   - Allow: <path>
 *   - Disallow: <path>
 *   - Wildcards `*` e âncora de fim `$` nas regras (RFC 9309 §2.2.3)
 *   - Comentários (`#`) e linhas em branco
 *   - Cache em memória por host em `fetchRobotsPolicy`
 */

interface Rule {
  kind: 'allow' | 'disallow';
  path: string;
  regex: RegExp;
}

interface Group {
  userAgents: string[];
  rules: Rule[];
}

export interface RobotsPolicy {
  /**
   * Retorna true se o user-agent pode acessar `path`.
   * Match de UA: case-insensitive por prefixo (ex: "imovibr" casa
   * "ImoviBR-Bot/1.0"). Grupo específico sobrepõe coringa `*`.
   */
  isAllowed(userAgent: string, path: string): boolean;
}

function compileRulePattern(pattern: string): RegExp {
  const hasEndAnchor = pattern.endsWith('$');
  const rawBody = hasEndAnchor ? pattern.slice(0, -1) : pattern;
  const escaped = rawBody
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}${hasEndAnchor ? '$' : ''}`);
}

export function parseRobotsTxt(text: string): RobotsPolicy {
  const groups: Group[] = [];
  let current: Group | null = null;
  let expectingUa = true; // true quando próximo User-agent inicia novo grupo

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (line === '') continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const field = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (field === 'user-agent') {
      if (expectingUa || current === null) {
        current = { userAgents: [value.toLowerCase()], rules: [] };
        groups.push(current);
        expectingUa = false;
      } else {
        // Múltiplos UAs consecutivos partilham as mesmas regras seguintes
        current.userAgents.push(value.toLowerCase());
      }
    } else if (field === 'allow' || field === 'disallow') {
      if (current === null) {
        // Regra sem UA — ignora (robots.txt malformado)
        continue;
      }
      expectingUa = true; // próximo UA abre novo grupo
      // Disallow vazio = permite tudo (não vira regra)
      if (field === 'disallow' && value === '') continue;
      if (value === '') continue;
      current.rules.push({
        kind: field,
        path: value,
        regex: compileRulePattern(value),
      });
    }
    // demais campos (sitemap, crawl-delay) ignorados
  }

  return {
    isAllowed(userAgent: string, path: string): boolean {
      const uaLower = userAgent.toLowerCase();
      // 1) Procura grupo específico (algum UA é prefixo do UA dado)
      const specific = groups.find((g) =>
        g.userAgents.some((ua) => ua !== '*' && uaLower.startsWith(ua)),
      );
      const wildcard = groups.find((g) => g.userAgents.includes('*'));
      const group = specific ?? wildcard;
      if (!group) return true;

      // 2) Regra mais específica (maior comprimento do path pattern) vence; empate → Allow
      let best: Rule | null = null;
      for (const rule of group.rules) {
        if (!rule.regex.test(path)) continue;
        if (best === null || rule.path.length > best.path.length) {
          best = rule;
        } else if (
          rule.path.length === best.path.length &&
          rule.kind === 'allow'
        ) {
          best = rule;
        }
      }
      if (best === null) return true;
      return best.kind === 'allow';
    },
  };
}

const robotsPolicyCache = new Map<string, RobotsPolicy>();

/** Limpa o cache em memória de `robots.txt` (útil em testes). */
export function clearRobotsPolicyCache(): void {
  robotsPolicyCache.clear();
}

/**
 * Fetch + parse `robots.txt` para um host, com cache em memória por host.
 * Retorna policy "allow all" se a requisição falhar (404, 403, network error) —
 * robots.txt inacessível equivale a permissão no fallback pela convenção.
 */
export async function fetchRobotsPolicy(
  host: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<RobotsPolicy> {
  const cached = robotsPolicyCache.get(host);
  if (cached) return cached;

  try {
    const res = await fetchFn(`https://${host}/robots.txt`, {
      headers: { accept: 'text/plain,*/*;q=0.8' },
    });
    if (!res.ok) {
      const fallback = parseRobotsTxt('');
      robotsPolicyCache.set(host, fallback);
      return fallback;
    }
    const text = await res.text();
    const policy = parseRobotsTxt(text);
    robotsPolicyCache.set(host, policy);
    return policy;
  } catch {
    return parseRobotsTxt('');
  }
}
