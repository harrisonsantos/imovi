# T4 — contrato e execução do enrichment IPTU

Data: 05/11/2026. Base: `f4aaf45`, branch `harrisonsantos/iptu-curitiba`.

## Objetivo e limites

Injetar adapters InfoSimples na CLI, normalizar Curitiba e utilizar cache antes
de consultar o provedor. Sem dependências novas, alterações de banco, web,
workflows, deploy, push ou consulta real. Fixtures são inteiramente sintéticas.
Após três falhas consecutivas pela mesma causa, reformular o diagnóstico.

## Decisões

- Reutilizar o transporte `fetch` do adapter InfoSimples existente, com um mapper
  específico de Curitiba. Evita duplicar timeout e tratamento de HTTP/429.
- `getIptu(address, taxYear): Promise<IptuRecord | null>` permanece o contrato.
  Acrescentar `areaM2?: number | null` (área construída em m²). Sem migration:
  persistir área também no `rawPayload`, que passa a ser uma projeção permitida,
  nunca a resposta bruta. Não persistir proprietário, CPF, mensagens ou URLs.
- Curitiba: envelope `{ code: 200, data: [imovel] }`, exatamente um resultado;
  `inscricao_imobiliaria`, `exercicio`, `area_construida`, `valor_venal`,
  `iptu_valor_total`. Valores ausentes ficam nulos; formato inválido, inscrição
  ausente, ano divergente, múltiplos resultados ou erro do provedor dão `null`.
  Dinheiro aceita número, decimal com ponto e formato brasileiro com milhares.
- Esse é um **contrato local sintético**, não confirmação do fornecedor. A
  [consulta pública de Curitiba](https://infosimples.com/consultas/pref-pr-curitiba-cnd/)
  documenta CND por CPF/CNPJ, não IPTU por endereço. Não reutilizar esse endpoint.
  `INFOSIMPLES_CURITIBA_ENDPOINT` deve ser confirmado com o fornecedor antes de
  configurar. Sem endpoint, Curitiba falha com `cobertura inexistente`.
- `INFOSIMPLES_TOKEN` já existe; endpoint Curitiba é a única variável nova.
  Configuração ausente nunca fabrica dados. Endpoint aceita apenas HTTPS na API
  InfoSimples, sem credenciais/query/fragmento; não seguir redirects com token.
- Preservar cache por CEP/número/ano e validade de 365 dias. Cache em memória por
  execução na CLI; binding `IPTU_CACHE` injetado no cron. Hits evitam chamadas;
  erros não são armazenados. Lote continua sequencial, sem retry automático.
- Falhas individuais continuam contabilizadas; o comando sinaliza erro ao fim
  se houver falhas, para que a CLI não reporte sucesso em cobertura inexistente.

## Plano e critérios de aceite

1. RED/GREEN em `packages/enrichment/tests/curitiba.test.ts` e
   `infosimples.test.ts`: normalização, schema, privacidade, HTTP, timeout,
   ausência/ambiguidade de dados e ano. Implementar mapper e transporte mínimo.
2. RED/GREEN em `fetch-iptu.test.ts` e `cache.test.ts`: seleção Curitiba,
   cobertura explícita, cache hit/miss/stale e serialização de Date. Implementar
   seleção e cache em `packages/enrichment/src`.
3. RED/GREEN nos testes worker de CLI, comando e cron: env → adapters → pipeline
   → persistência sanitizada, ausência de configuração e falhas com exit 1.
   Implementar wiring apenas no fluxo IPTU.
4. Rodar `pnpm lint`, `pnpm typecheck`, `pnpm test`; registrar resultados aqui,
   revisar diff, fazer commit local excluindo `.task-T4.md`.

## Evidência

Verificação local em 05/11/2026, após as alterações finais de código:

| Gate                      | Status  | Evidência                                                                                                                              |
| ------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| TDD adapters              | PASS    | RED: 16 falhas (export Curitiba ausente, PII preservada, respostas vazias aceitas); GREEN: pacote com 28 testes.                       |
| TDD seleção/cache         | PASS    | RED: 9 falhas; GREEN: pacote enrichment com 37 testes.                                                                                 |
| TDD CLI/comando           | PASS    | RED: 11 falhas; GREEN: 11 testes de integração sem rede/banco externo.                                                                 |
| TDD cron                  | PASS    | RED: 2 falhas (sem injeção, rejeição absorvida); GREEN: 2 testes.                                                                      |
| `pnpm lint`               | PASS    | Exit 0; 14/14 tarefas, 12 em cache. Warnings preexistentes de directives ESLint não usadas.                                            |
| `pnpm typecheck`          | PASS    | Exit 0; 15/15 tarefas, 12 em cache. Erros iniciais da fixture fora do rootDir e logger incompleto corrigidos.                          |
| `pnpm test`               | PASS    | Exit 0; 15/15 tarefas, 13 em cache na rodada final. Enrichment 37 e worker 44 testes, executados novamente sem cache; 38 testes novos. |
| Diff e escopo             | PASS    | Sem alteração de package.json, lockfile, web, migrations ou workflows; `.task-T4.md` excluído do commit.                               |
| Credencial/cobertura real | BLOCKED | Confirmar endpoint IPTU Curitiba, parâmetros, autenticação e resposta com o fornecedor; fornecer credencial em ambiente autorizado.    |
| Consulta paga/deploy/push | NOT RUN | Nenhuma consulta real, publicação ou envio remoto realizado.                                                                           |

Logs locais ignorados pelo Git: `t4-red-adapters.log`, `t4-red-cache.log`,
`t4-red-command.log`, `t4-red-cron.log`, `t4-green-*.log`,
`t4-lint-final.log`, `t4-types-final.log`, `t4-test-final.log`.
O Turbo também avisa que os testes não produzem arquivos de saída; isso não
altera seu exit 0. A primeira suíte completa executou DB90, Audit84 e Web114;
a rodada final reutilizou esses resultados, sem mudanças nesses pacotes.

## Operação após desbloqueio externo

Carregar as variáveis no ambiente do processo (a CLI não carrega `.env` sozinha).
`DATABASE_URL` aponta para staging autorizado. `INFOSIMPLES_TOKEN` é segredo;
`INFOSIMPLES_CURITIBA_ENDPOINT` é a URL HTTPS confirmada, sem token na URL.
O request mantém o transporte existente: POST JSON com `cep`, `numero`,
`exercicio` e autenticação Bearer; confirmar esses parâmetros/autenticação junto
com o contrato de resposta antes de qualquer uso real. O endpoint sintético dos
testes não é um serviço a configurar. Nenhum segredo ou URL real foi usado.

Com configuração confirmada e autorização para consulta paga:
`pnpm --filter @imovi/worker dev enrich-iptu --limit 1`.
Ano padrão: ano UTC corrente. O comando aceita `taxYear` por injeção para jobs
programáticos. Sem token, CLI falha antes de acessar o banco; com token e sem
endpoint Curitiba, somente SP tem adapter. Falhas de consulta/schema retornam
`null`, não são cacheadas e contam no resultado do lote; qualquer falha resulta
em exit 1 na CLI/rejeição do cron. Registros válidos do lote são preservados.

O filtro existente do banco ainda seleciona imóveis sem IPTU fresco nos últimos
365 dias, independentemente do exercício; T4 não altera esse repositório nem
introduz política de reconsulta anual. A área enriquecida fica na projeção fiscal
do registro IPTU; não sobrescreve a área do imóvel/anúncio.
