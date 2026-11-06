# Plano unificado — Imovi (AVM + Auditoria B2B)

Data: 05/11/2026. Fonte única de verdade do projeto, consolidando o trabalho feito
com Claude Code e Codex. Substitui a leitura avulsa dos documentos abaixo, que
continuam válidos como detalhe:

| Documento | Origem | Papel |
| --- | --- | --- |
| [stabilization/spec.md](stabilization/spec.md) | Codex | Critérios AC-001..AC-012 e regras de rollout |
| [stabilization/evidence.md](stabilization/evidence.md) | Codex | Evidência local e gates externos |
| [../monetization-readiness.md](../monetization-readiness.md) | Codex | Planos, cobrança, anúncios, P0 comerciais |
| [../seo-agressivo.md](../seo-agressivo.md) | Codex | SEO programático e clusters |
| [../deploy-runbook.md](../deploy-runbook.md) | Claude + Codex | Deploy, variáveis, rollback |
| Memória Claude (projeto/auditoria) | Claude | Decisões de ML, multi-cidade, auditoria |

## 1. Estado consolidado

**Em `origin/main` (be4087f):** AVM Curitiba em produção (scraping 3 portais, LightGBM
v1 ativo), multi-cidade (código), Auditoria B2B F1–F9 (multi-tenant, Vista, 6 detectores,
cron, matrículas R2), monetização (Stripe checkout/portal/webhook, AdSense, termos) e SEO
programático, CI com provisionamento R2.

**Integrado nesta branch (antes só existia sem commit em `C:/unkownimbo`, branch
`codex/vercel-release`):** estabilização do Codex, 127 arquivos e migration `0007`.
Ela cobre membership por request, verificação de e-mail, Turnstile fail-closed, rate limit
atômico, resultado reproduzível, waitlist persistida, inbox de billing com leases, split
temporal no treino, artefatos imutáveis, readiness e workflow `checks.yml`.

Verificado aqui em 05/11/2026: `pnpm lint` (14/14), typecheck (15/15),
`pnpm test` (15 tarefas, todos passaram) e `pytest` (52 passaram).

**Fora do repositório:** os modelos `ml-training/models/*.onnx` (v1, v2 e quantis) ficaram
em `C:/unkownimbo`, porque são artefatos e não vão para o git. O lixo `now()-interval` não
foi trazido.

**Branches antigas:** `claude/fase-6-frontend`, `codex/fix-r2-deploy`,
`codex/monetizacao-seo`, `claude/priceless-*`, `claude/modest-*`, `claude/thirsty-*`,
`claude/admiring-*` e `claude/competent-*` já estão contidas em `main` ou desatualizadas.
A única com conteúdo não integrado é `claude/distracted-mcclintock` (`scripts/first-deploy.ps1`
e a remoção do KV `IPTU_CACHE` do Pages), que entra na tarefa T2. O `main` local diverge do
remoto (5/2), mas o conteúdo já foi absorvido pelo PR #3.

## 2. Frentes de trabalho e alocação

Critério de alocação:

- **Codex:** refatorações longas e mecânicas de build e dependências, e backend com TDD
  estrito. Foi ele que escreveu os patches do adaptador.
- **Claude:** produto, UX e copy em pt-BR, coordenação, specs, review e integração.
- **Usuário:** tudo que exige credencial, conta externa, aprovação de produção ou
  decisão jurídica.

| ID | Tarefa | Executor | Workspace | Depende de |
| --- | --- | --- | --- | --- |
| T1 | Integrar estabilização, plano unificado e PR para `main` | Claude (coordenador) | este | — |
| T2 | Trocar `@cloudflare/next-on-pages` por `@opennextjs/cloudflare` (Workers), remover `patches/`, resolver o KV do Pages e o `first-deploy.ps1` | Codex | novo `opennext` | T1 |
| T3 | Fechar os P0 de confiança: `/precos` só vende o que existe, `/dashboard` rotulado como demo ou sem link, sem "ilimitado", aceite de termos com versão/data persistido (migration 0008) | Claude | novo `produto-p0` | T1 |
| T4 | IPTU: injetar InfoSimples na CLI e criar o adapter Curitiba com TDD e fixtures, sem rede real e sem dependência nova | Codex | novo `iptu-curitiba` | T1 |
| T5 | Atualizar tooling com avisos moderados (Vitest/esbuild) | Codex | depois de T2 | T2 |
| T6 | Retreinar e promover o v2 com corpus real e split temporal | Claude | — | G1, G4 |
| T7 | Corretor Pro (R$ 39–59) e API: spec e entitlements | Claude (spec) + Codex (impl.) | — | T3 e G3 |

T2, T3 e T4 não compartilham arquivos de produto. O lockfile só pode mudar em T2.
T3 é dona da migration `0008`.

## 3. Gates externos (usuário)

| Gate | O que fazer | Desbloqueia |
| --- | --- | --- |
| G1 | Neon staging: snapshot/backup e `DATABASE_URL` de staging; aplicar `0002`..`0007` em staging | Readiness, T6, deploy |
| G2 | Secrets: `BETTER_AUTH_SECRET`, `VISTA_KEY_SECRET`, `RESEND_API_KEY` (rotacionar), Turnstile site/secret | AC-002/003 em staging |
| G3 | Stripe sandbox: produtos/prices `STRIPE_PRICE_*`, webhook, portal; depois o ciclo do runbook | AC-006, cobrança |
| G4 | Aprovar o upload do modelo v2 ao R2 e a ativação | T6 |
| G5 | R2 `imovi-matriculas`; reapontar o webhook Vista; apagar Vercel `imobcheck-sepia` e Supabase legado | Auditoria em produção |
| G6 | Revisão jurídica de termos/privacidade e definição fiscal | Venda comercial |
| G7 | Aprovação explícita de produção, depois de G1–G3 e do preview verde no mesmo SHA | Go-live |

## 4. Regras comuns a todas as tarefas

- TDD: teste falhando antes da implementação. Nenhum requisito é afrouxado para passar um check.
- Sem deploy, sem migration em banco externo, sem push e sem cobrança real. Credencial ausente
  vira `BLOCKED`, nunca `PASS` local.
- Evidência de conclusão: `pnpm lint`, `pnpm typecheck` e `pnpm test` verdes (e `pytest` quando
  tocar `ml-training`), mais um resumo do diff e um commit local na branch da tarefa.
- Imports de operadores drizzle em `apps/web` sempre via `@imovi/db/operators`.
- No máximo três tentativas pela mesma causa; depois disso, reformular e reportar.
