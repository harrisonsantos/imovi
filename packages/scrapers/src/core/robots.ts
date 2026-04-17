/**
 * Parser minimalista de robots.txt (RFC 9309 subset).
 *
 * Suporta:
 *   - User-agent: <nome>  (case-insensitive, match por prefixo)
 *   - Allow: <path>
 *   - Disallow: <path>
 *   - Comentários (`#`) e linhas em branco
 *
 * NÃO suporta (ainda):
 *   - Sitemap, Crawl-delay, Host (campos não normativos)
 *   - Wildcards `*` e `$` nas regras (RFC 9309 §2.2.3)
 *
 * Para MVP é suficiente: checa prefixo literal, aplicando regra mais
 * específica (maior comprimento) em caso de conflito Allow/Disallow.
 */

interface Rule {
  kind: 'allow' | 'disallow';
  path: string;
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
      current.rules.push({ kind: field, path: value });
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

      // 2) Regra mais específica (maior comprimento) vence; empate → Allow
      let best: Rule | null = null;
      for (const rule of group.rules) {
        if (!path.startsWith(rule.path)) continue;
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

/**
 * Fetch + parse `robots.txt` para um host. Retorna policy "allow all"
 * se a requisição falhar (404, network error, etc.) — robots.txt ausente
 * equivale a permissão total pela convenção.
 */
export async function fetchRobotsPolicy(
  host: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<RobotsPolicy> {
  try {
    const res = await fetchFn(`https://${host}/robots.txt`, {
      headers: { accept: 'text/plain' },
    });
    if (!res.ok) return parseRobotsTxt('');
    const text = await res.text();
    return parseRobotsTxt(text);
  } catch {
    return parseRobotsTxt('');
  }
}
