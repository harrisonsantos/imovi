# Web Worker: migração T2

Next.js App Router em Cloudflare Workers. Veja o [README principal](../../README.md)
e o [runbook](../../docs/deploy-runbook.md).

```sh
pnpm --filter @imovi/web dev
pnpm --filter @imovi/web test
pnpm --filter @imovi/web build:cf
```

Configure `apps/web/.env.local` a partir de `.env.example`. Produção/preview
exigem bindings de banco, auth, e-mail e Turnstile. O estimador salva uma
heurística identificada; ONNX continua desativado neste runtime.

## Contrato e escopo

Substituir `@cloudflare/next-on-pages` por `@opennextjs/cloudflare`, preservando
URLs, handlers e bindings do app. Next permanece na série 15.5: o patch 15.5.29
atende ao peer do adaptador 1.20.16, com Wrangler 4.158.0. Não alterar produto,
migrations, auditoria compartilhada ou Worker de jobs; não publicar nem acessar
contas Cloudflare durante a validação local. Até três tentativas pela mesma causa;
uma falha persistente exige reformulação e relato, sem afrouxar o aceite.

As configurações `runtime = 'edge'` foram removidas: o adaptador usa o runtime
Node.js do Next dentro do Worker com `nodejs_compat`. Os endpoints continuam
sendo servidos pela Cloudflare. Exceção pontual autorizada durante a tarefa:
na imagem OpenGraph, separar cor e gradiente em `backgroundColor` e
`backgroundImage`, preservando texto e aparência. O build revelou a rejeição
do shorthand pelo renderizador; `tests/opengraph-image.test.ts` reproduziu a
falha antes da correção e verifica os bytes PNG reais.

## Decisões

- `getCfEnv()` lê `getCloudflareContext().env` a cada requisição, com precedência
  sobre `process.env` e fallback fora do Worker. Objetos R2 não são serializados.
- `MODEL_ARTIFACTS` e `MATRICULAS` permanecem, isolados por ambiente. Secrets de
  DB, auth, Turnstile e Stripe continuam chegando por bindings de runtime.
- Sem consumidor de `IPTU_CACHE` no código web: removido deste Wrangler; permanece
  no Worker de jobs. Não é um cache do OpenNext.
- Prerenders usam o cache de leitura em Static Assets. Rotas de dados dinâmicas
  mantêm SSR; não há ISR nem invalidação por tags. Introduzir ISR futuramente
  exige outra configuração de cache, sem reutilizar os buckets de negócio.
- `scripts/first-deploy.ps1` de `eaec4bf` não foi incorporado: é específico de
  Pages, fixa conta, continua após falhas de R2 e publica antes de configurar
  secrets. O fluxo autorizado está em [deploy-runbook](../../docs/deploy-runbook.md).

## Aceite verificável

| Critério                                             | Verificador                                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| Bindings por requisição, prioridade e fallback       | `tests/cf-env.test.ts`, ciclo red/green                                          |
| Contratos de auth, billing, proteção, readiness e R2 | suíte web existente e `pnpm test`                                                |
| Dependências reproduzíveis sem patches               | `pnpm install --frozen-lockfile`; ausência de `patches/` e `patchedDependencies` |
| Código e tipos                                       | `pnpm lint`; `pnpm typecheck`                                                    |
| Artefato Worker e assets                             | `pnpm --filter @imovi/web build:cf`                                              |
| Configuração padrão e preview                        | `pnpm --filter @imovi/web exec wrangler deploy --dry-run` e `--env=preview`      |
| Runtime local                                        | preview local: home, health e ready sem credenciais externas                     |

`pnpm --filter @imovi/web preview` serve o build em workerd local. Para bindings
no `next dev`, o config inicializa `initOpenNextCloudflareForDev`. Valores locais
ficam em `.dev.vars` (ignorado); segredos reais não pertencem ao build.
`pnpm --filter @imovi/web cf:typegen` regenera os bindings do Wrangler;
`@cloudflare/workers-types` é dependência explícita para os tipos de runtime R2.

Build e dry-run não comprovam Neon, R2, Turnstile, Stripe, auth nem DNS reais.
Esses gates continuam dependentes de staging autorizado. Ver também o
[guia OpenNext](https://opennext.js.org/cloudflare/get-started) e sua
[configuração de cache](https://opennext.js.org/cloudflare/caching).

## Evidência local T2

Verificação em 05/11/2026, Node 22.18.0 e pnpm 9.15.9. Build/dry-run/runtime em
container Linux `node:22.18.0-bookworm-slim`, com `ca-certificates` para workerd.
Snapshot dos arquivos da worktree, sem `.task-T2.md`, credenciais, dependências
ou outputs do Windows; instalação frozen limpa no container. Os demais checks
rodaram na worktree Windows. Não houve deploy, push ou acesso a contas Cloudflare.

| Comando / verificação                                                          | Resultado                                                                                                        |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                               | PASS no Windows e Linux                                                                                          |
| `pnpm lint`                                                                    | PASS, 14 tarefas; warnings preexistentes de directives não usadas                                                |
| `pnpm typecheck`                                                               | PASS, 15 tarefas                                                                                                 |
| `pnpm test`                                                                    | PASS, 15 tarefas, 456 testes; web 121                                                                            |
| `pnpm --filter @imovi/web cf:typegen --check`                                  | PASS                                                                                                             |
| `pnpm turbo run build --filter=@imovi/web^...`                                 | PASS no container limpo                                                                                          |
| `pnpm --filter @imovi/web build:cf`                                            | PASS Windows e Linux, 44 páginas geradas e Worker completo                                                       |
| `pnpm --filter @imovi/web exec wrangler deploy --dry-run`                      | PASS Windows (145 assets; gzip 2324.62 KiB) e Linux (143 assets; gzip 2309.69 KiB)                               |
| Mesmo dry-run com `--env=preview`                                              | PASS Windows e Linux, R2 e SELF_REFERENCE isolados                                                               |
| `pnpm --filter @imovi/web preview --port 8788 --ip 0.0.0.0` + smoke HTTP local | PASS: home/assets/PNG 200, health 200, ready 503 sem DB/secrets, estimate 503 sem Turnstile                      |
| `patches/`, `pnpm.patchedDependencies` e dependência `next-on-pages`           | PASS: removidos                                                                                                  |
| Build nativo Windows (`scripts/build-cf.mjs` + `tests/build-cf.test.ts`)       | PASS: fallback `EPERM` para junctions relativas preservando standalone/OpenNext                                  |
| `pnpm audit --prod --audit-level=high`                                         | FAIL: 3 críticas, 11 altas, 15 moderadas, 5 baixas                                                               |
| Provedores reais, CI remoto, deploy e corte de domínio                         | NOT RUN; gates de staging permanecem                                                                             |

A auditoria atual da base `f4aaf45` também falha: 4 críticas, 12 altas, 13
moderadas e 5 baixas. O patch de Next remove avisos dessa base; overrides
`glob@10`, `brace-expansion@2` e `brace-expansion@5` eliminam as novas altas do
adaptador. Permanecem dois avisos moderados novos de `glob`/`minimatch` no tooling
de build, além dos avisos preexistentes. Não se altera o gate do CI: o workflow
continua bloqueado pela auditoria, e T5/atualização de auth precisam tratá-la.
O peer Better Call/Zod também permanece. Isto não constitui aprovação de segurança.

O preview não herda vars do Wrangler principal: a site key pública de Turnstile
precisa corresponder ao hostname e ser fornecida no build. O workflow mantém
esse valor explícito; configurar secrets e hostnames reais continua sendo gate
externo. O warning de vars não herdadas no dry-run não foi ocultado.

Logs locais ignorados pelo Git: `t2-frozen.log`, `t2-lint.log`,
`t2-typecheck.log`, `t2-test.log`, `t2-red.log`, `t2-green.log`,
`t2-og-red.log`, `t2-og-green.log`, `t2-linux-install.log`,
`t2-linux-build.log`, `t2-dry-run.log` e `t2-smoke.log` na raiz da worktree.
