# Bloqueadores do PR #5

Base verificada: `3a21864`, sincronizada com `origin/harrisonsantos/integracao`.
Objetivo: corrigir os cinco grupos solicitados com TDD e commit local.

## Contratos e verificadores

| Contrato | Evidência |
| --- | --- |
| Worker `/ready`: `{ status: 'ready', checks: { db: 'ok' } }` | worker `readiness.test.ts` |
| Paywall deriva preços/limites de BILLING_PLANS, sem ilimitados | web `product-trust.test.ts` |
| Origin obrigatório e exato; três mutações de auditoria retornam 403 antes de efeitos | web `billing.test.ts`, `auditoria-api.test.ts` |
| PDF/JPEG/PNG têm assinatura binária correspondente; falha no insert limpa R2 sem mascarar erro original | web `matricula.test.ts`, `auditoria-api.test.ts` |
| Cron inclui active/past_due/trial sem prazo ou futuro, exclui trial vencido inclusive limite exato | DB `audit-repos.test.ts` com PGlite |
| Dependências sem high/critical; Turnstile configurado no preview | audit, build Cloudflare e inspeção de wrangler.toml |

Restrições: preservar members.ts, terms.ts, migrations, página de privacidade e
packages/scrapers. Nenhum deploy, push ou alteração em banco remoto. Operadores
Drizzle usados pelo web vêm de @imovi/db/operators. O título do item 4 cita plano,
mas não define nova regra para assertOrgAccess; preservar o contrato atual salvo
esclarecimento do usuário.

Execução: testes RED antes de correções; GREEN focalizado; gates completos;
revisão do diff e commit. Após três falhas de mesma causa, reavaliar a abordagem
e registrar impedimento se depender de mudança externa.

## Evidência

- Inicial: audit FAIL (11 high, 3 critical); demais gates pendentes.
- RED: web 22 regressões falhando em 73 testes; Worker 1/4 falhando;
  repositórios 1/42 falhando (cron incluía trials expirados e excluía past_due).
- GREEN focalizado antes do upgrade: web 102/102, Worker 4/4, cron 1/1.
- Audit após overrides: PASS, zero high/critical (1 low e 9 moderate restantes).
- Compatibilidade Zod: typecheck reproduziu cinco chamadas z.record com apenas
  um argumento; declaradas chaves string mantendo o contrato dos valores.
- Lint e typecheck completos: PASS; lint mantém 12 avisos em arquivos não alterados.
- Lockfile: `pnpm install --frozen-lockfile --ignore-scripts` PASS.
- Testes e build Cloudflare (`pnpm test`, `pnpm --filter @imovi/web build:cf`): PASS.

## Dependências e alinhamento de schema do Better Auth 1.7.7

Overrides: sharp 0.35.5, undici 7.30.1, vite 6.4.4, source-map-js 1.2.2,
tinypool 2.1.2, better-auth 1.7.7 e zod 4.6.6. Referências dos mantenedores:
[Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5),
[Tinypool](https://github.com/advisories/GHSA-85c8-ppgw-ccpr),
[Better Auth](https://github.com/better-auth/better-auth/releases/tag/v1.7.7).

`auth-verification-flow.test.ts` detectou `Drizzle schema mismatch / Missing columns / invitation.createdAt`
com Better Auth 1.7.7. Com autorização para migration aditiva, foram adicionadas
`packages/db/migrations/0011_invitation_created_at.sql` e
`packages/db/migrations/0011_invitation_created_at_pglite.sql` sem editar migrations existentes:

```sql
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
```

`createdAt` foi declarado em `invitations` no `packages/db/src/schema-auth.ts`,
a migration `0011_invitation_created_at_pglite.sql` foi registrada em
`packages/db/tests/setup.ts` e os testes validam linhas existentes (`auth-tables.test.ts`)
e o fluxo real de autenticação (`auth-verification-flow.test.ts`). Nenhuma migration
remota foi executada.
