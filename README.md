# Imovi

Monorepo do estimador imobiliário e da Auditoria de carteira. Web em Next.js/Cloudflare Pages, jobs em Cloudflare Workers e dados em Neon Postgres. O estimador público entrega uma **heurística identificada**; ONNX permanece desativado até validação independente de inferência e qualidade temporal.

Referências iniciais dos seeds não são preços de transações. Medianas observadas usam anúncios válidos de venda, observações de até 90 dias e pelo menos vinte imóveis distintos. O relatório recupera o cálculo persistido, com parâmetros e origem/data; não gera comparáveis ou histórico inexistentes.

## Trabalho local

Requer Node 22, pnpm 9.15.9 e uv/Python 3.13. No PowerShell, use `pnpm.cmd` se a política bloquear scripts.
O build de Pages no Windows também requer Git for Windows (Git Bash); o wrapper o seleciona automaticamente. Não é necessário alterar permissões do sistema.

```sh
pnpm install --frozen-lockfile
pnpm validate
cd ml-training
uv sync --frozen
uv run --frozen pytest
```

`pnpm test` mantém um worker por pacote e executa pacotes sequencialmente para evitar disputa na inicialização do PGlite. Os testes usam banco em memória; não acessam Neon. `pnpm validate` executa lint, tipos e testes, sem publicar ou migrar bancos.

Copie `.env.example` para `apps/web/.env.local` para a web; configure variáveis do terminal para a CLI. Valores de exemplo são placeholders. Nunca compartilhe arquivos de segredos. Desenvolvimento: `pnpm --filter @imovi/web dev`. Ambientes e provedores estão no [runbook](docs/deploy-runbook.md).

## Estrutura

| Diretório                                                 | Responsabilidade                                               |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| `apps/web`                                                | Formulário, resultados persistidos, auth, Auditoria e cobrança |
| `apps/worker`                                             | Coleta, enriquecimento, medianas e rotinas da Auditoria        |
| `packages/db`                                             | Schema, migrations SQL, repositórios e testes PGlite           |
| `packages/shared`, `normalizer`, `scrapers`, `enrichment` | Contratos, deduplicação, fontes e IPTU                         |
| `packages/audit`                                          | Análise de carteira e relatórios                               |
| `packages/ml-infer`                                       | Inferência experimental; desativada no estimador público       |
| `ml-training`                                             | Exportação temporal, treino, avaliação e promoção versionada   |

```sh
pnpm turbo run build --filter="@imovi/web^..." --filter="@imovi/worker..."
pnpm --filter @imovi/web build:cf
pnpm --filter @imovi/worker exec wrangler deploy --dry-run
pnpm audit --prod --audit-level=high
```

Pages utiliza o adaptador legado `next-on-pages`. Sua substituição requer spec própria, preview e rollback; esta estabilização mantém Cloudflare.

## Próxima liberação

Consulte a [spec](docs/specs/stabilization/spec.md) e as [evidências atuais](docs/specs/stabilization/evidence.md). CI valida o código; publicação é manual, verifica o SHA escolhido e exige confirmação explícita para produção. `/api/health` e `/health` são liveness; `/api/ready` e `/ready` verificam prontidão e retornam `503` quando indisponíveis.

Migrations exigem backup, staging isolado e autorização específica. Jornada autenticada, e-mail, Turnstile, Stripe sandbox e restauração devem ser demonstrados antes de cobrar clientes. Evidência local não substitui esses gates externos.
