# Evidências da estabilização

Data: 30/09/2026. Implementação local na branch `codex/vercel-release`, base `be4087f919a1bc71f96e972a1deba5c6d48ded5a`. Fetch repetido após integração: `origin/main`, 0 à frente/0 atrás. Alterações preexistentes e artefatos locais preservados; não houve merge, publicação ou migration externa.

## Checks locais

| Gate                       | Status                     | Evidência                                                                                                                                                                    |
| -------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git e preservação          | PASS                       | Fetch atual; `.claude` e artefatos não relacionados preservados.                                                                                                             |
| Instalação frozen          | PASS                       | `pnpm install --frozen-lockfile --offline` após os patches finais: lockfile consistente.                                                                                     |
| Lint                       | PASS                       | 14 tarefas; permanecem warnings preexistentes de directives ESLint não usadas.                                                                                               |
| Tipos                      | PASS                       | 15 tarefas, com concorrência2 na integração.                                                                                                                                 |
| Testes TypeScript          | PASS                       | Comando padrão `pnpm test`: 461 testes, 15 tarefas; DB90, web114, Audit84, Worker31. Parte das tarefas sem alteração foi atendida pelo cache.                                |
| Python                     | PASS                       | 52 testes, incluindo gate antes de artefatos, identidade e treino/teste temporal.                                                                                            |
| API+SQL real em memória    | PASS                       | 3 testes: resultado preservado após mudar mediana, 429 na tentativa11 e isolamento de IP, waitlist com consentimento. Somente provedor Turnstile simulado.                   |
| Identidade real em memória | PASS                       | Better Auth1.6.22 + PGlite: signup sem sessão, login não verificado403, link de verificação, login/owner/trial e bloqueio de outra organização. Provedor de e-mail simulado. |
| Cobrança e recuperação     | PASS local                 | Web33 e repositório11: request Stripe imutável, duplicatas/leases, rollback da conclusão, retomada e reconciliação de estado atual. Stripe simulado.                         |
| Migration0007              | PASS local                 | Banco legado PGlite: eventos antigos preservados, novos pendentes, backfill somente com associação comprovável e rerun sem perda/duplicação. Não valida Neon/PostGIS.        |
| Next.js                    | PASS                       | Build15.5.24 completo, com tipos e lint.                                                                                                                                     |
| Pages                      | PASS                       | Comando padrão `pnpm --filter @imovi/web build:cf`, exit0; 37 rotas edge e 23 prerenderizadas. Sem publicação.                                                               |
| Worker                     | PASS                       | Bundle `--dry-run` top-level e preview; bindings isolados no preview. Sem upload.                                                                                            |
| Auditoria de dependências  | PASS no gate critical/high | 0 críticas,0 altas,3 moderadas,1 baixa. Auditoria sem filtro retorna não zero pelos avisos restantes.                                                                        |

Logs locais em `.codex/`: `test-final.log`, `public-db-test.log`, `migration-test.log`, `lint-final.log`, `types-final.log`, `dependency-audit.json`, `worker-bundle.log`, `worker-preview-bundle.log`, `pages-build-final.log`, `frozen-install-final.log` e `audit-gate-final.log`. Logs são evidência local, não documentação de produção; não incluir credenciais neles.

## Rastreabilidade

| Aceite     | Verificação local                                                               | Gate externo                                                                                                  |
| ---------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| AC-001/002 | `session-membership`, `auth-config`, `auth-verification-flow`, `billing-routes` | Duas contas/organizações e entrega real de e-mail em staging.                                                 |
| AC-003     | `estimate-protection`, `public-routes`, `public-db-flow`, DB `stabilization`    | Turnstile e IP Cloudflare reais.                                                                              |
| AC-004/005 | DTO, rotas públicas, estimates repo e fluxo API+SQL                             | Browser formulário→resultado e waitlist no preview real.                                                      |
| AC-006     | Billing routes + recovery DB e script de replay                                 | Lifecycle completo Stripe sandbox, concorrência/interrupção e reconciliação no provedor.                      |
| AC-007     | Pipeline scrape, listings, neighborhoods e migration                            | Fonte real autorizada, qualidade/amostra atual, medianas no banco real.                                       |
| AC-008/009 | Python52, model cache, workflow de versões imutáveis                            | Treino com corpus real, upload/ativação/rollback em R2+Neon; inferência ONNX Cloudflare permanece desativada. |
| AC-010/011 | Readiness web/Worker, workflows, builds e dependências                          | Executar checks/deploy preview no mesmo SHA e demonstrar indisponibilidade/recuperação.                       |
| AC-012     | README, env e runbook atualizados                                               | Provisionamento e configuração ainda precisam confirmação em staging.                                         |

## Avisos e compatibilidade

- Next15.5.24, Drizzle0.45.2, Better Auth1.6.22 e Vitest3.2.6 fixados. Transitividades críticas/altas corrigidas por overrides; protobufjs7.6.5 e PostCSS8.5.23 também corrigem avisos moderados.
- Restam esbuild em tooling legado (moderado/baixo) e Vitest/mocker (moderados). Paths constam no JSON da auditoria. Testes usam `vitest run`, sem UI/servidor exposto. Não foi demonstrada exposição dessas ferramentas pelo runtime publicado. Upgrade de tooling e remoção do adaptador legado continuam pendentes, sem considerar o gate alto/crítico como auditoria totalmente limpa.
- `next-on-pages` ainda declara peer Next<=15.5.2; Better Call declara peer Zod4 enquanto os contratos do app usam Zod3. Compatibilidade é verificada pelos builds e integração real de auth; warnings não foram ocultados. Adaptador novo exige spec própria.
- Patches rastreados corrigem caminhos POSIX de rotas estáticas no builder e junctions de diretórios somente no Windows. A normalização segue a [correção upstream do Vercel](https://github.com/vercel/vercel/blob/main/packages/next/src/utils.ts); remover patches quando versões oficiais incluírem os ajustes e o build completo passar. O wrapper seleciona Git Bash no Windows, sem mudar permissões do sistema.

## Gates externos

| Gate                                  | Status  | Condição para avançar                                                                    |
| ------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| Migrations Neon, backup e restauração | BLOCKED | DATABASE_URL de staging autorizado, backup/snapshot e teste de restauração.              |
| Provedores/auth/Turnstile             | BLOCKED | Credenciais sandbox/teste e hostname correspondente, além de duas organizações de teste. |
| Stripe sandbox completo               | BLOCKED | Chaves/prices/webhook e portal do mesmo sandbox; validar todos os cenários do runbook.   |
| Coleta e corpus reais                 | NOT RUN | Executar jobs no staging autorizado e registrar amostra, origem e recência.              |
| Preview e rollback externos           | NOT RUN | Provisionar bindings isolados, aplicar migrations e executar workflow/smoke/jornadas.    |
| Produção/cobrança real                | NOT RUN | Aprovação explícita após todos os gates externos.                                        |

Um checkout sem session ID após timeout permanece preservado e bloqueia nova tentativa até reconciliação; não supõe que Stripe deixou de criar a cobrança.

Atualização T4 (05/11/2026): a CLI e o cron IPTU agora injetam InfoSimples e há um
adapter Curitiba com contrato sintético, normalização e projeção fiscal sem
nome/CPF. Configuração isolada não comprova cobertura real: credencial e contrato
do fornecedor continuam **BLOCKED**. Ver [contrato e evidências T4](../iptu-curitiba.md).
