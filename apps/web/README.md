# @imovi/web

Next 15 (App Router, edge runtime) — landing + formulário de estimativa AVM para Curitiba/PR.

Deploy: Cloudflare Pages.

## Dev local

```bash
pnpm --filter @imovi/web dev
```

Requer `.env.local` em `apps/web/`:

```env
DATABASE_URL=postgres://...            # Neon Postgres (obrigatório)
TURNSTILE_SECRET=                      # opcional em dev — ausente desabilita validação
NEXT_PUBLIC_TURNSTILE_SITE_KEY=        # opcional em dev — ausente não renderiza widget
```

## Cloudflare Turnstile

Ambiente prod precisa das duas variáveis:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — exposta ao client, renderiza o widget.
- `TURNSTILE_SECRET` — server-only, valida o token via `/siteverify`.

Criar as chaves no dashboard Cloudflare > Turnstile. Em dev, pode-se usar a
site key de teste `1x00000000000000000000AA` (sempre passa) com secret
`1x0000000000000000000000000000000AA`.

Se `TURNSTILE_SECRET` estiver ausente em runtime, a validação é pulada e
um warning é emitido 1x por worker instance — útil para desenvolvimento.

## Deploy

Push para `main` dispara o CI (GitHub Actions) que faz build + deploy
para Cloudflare Pages. Secrets de prod configurados no dashboard CF.

## Rotas

- `/` — landing + form (SSR)
- `/api/estimate` — POST, estima valor (edge)
- `/api/neighborhoods` — GET, lista bairros (edge)
- `/robots.txt`, `/sitemap.xml` — gerados via App Router metadata files
