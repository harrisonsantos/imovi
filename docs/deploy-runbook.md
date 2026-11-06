# Operação, staging e recuperação

Este runbook acompanha a spec `docs/specs/stabilization/spec.md`. Os comandos que escrevem em provedores exigem ambiente staging autorizado. Produção necessita aprovação explícita, backup e evidência de restauração. Nunca use credenciais reais de cobrança nos ensaios.

## Ambientes e provedores

- **Neon:** branch/banco isolado de staging com PostGIS e pgvector conforme migrations; `DATABASE_URL` como secret em Pages e Worker. Não reutilizar a URL de produção no preview.
- **Cloudflare Pages:** projeto `imovi-web`, branch `preview`, binding `NEXT_PUBLIC_APP_ENV=preview`; `IPTU_CACHE`, `MODEL_ARTIFACTS`, `MATRICULAS` devem apontar para recursos de preview declarados em `apps/web/wrangler.toml`.
- **Worker:** `--env=preview`, buckets separados e crons desativados; execute jobs de staging manualmente. A ausência de `--env` seleciona produção, nunca implicitamente em ensaios.
- **R2:** provisionar `html-snapshots-preview`, `imovi-model-artifacts-preview`, `imovi-matriculas-preview` antes do deploy de preview. IDs KV devem ser conferidos na conta autorizada. Configuração no arquivo não prova existência do recurso.
- **Auth:** `BETTER_AUTH_SECRET` aleatório >=32 caracteres, `BETTER_AUTH_URL` HTTPS correspondente ao ambiente. Remetente `EMAIL_FROM` verificado e `RESEND_API_KEY`; prod/preview exigem verificação de e-mail e falham fechados na ausência dessa configuração.
- **Turnstile:** site key público embutido no build para o hostname correto, `TURNSTILE_SECRET` privado como binding. Ausência em produção/preview retorna indisponibilidade; token inválido é recusado. IP confiável vem do Cloudflare. `ESTIMATE_RATE_LIMIT_PER_MINUTE` padrão10, entre1 e1000; contador SQL compartilhado, IP somente em hash.
- **Stripe:** `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_WEBHOOK_SECRET` de endpoint de sandbox e três `STRIPE_PRICE_AUDIT_*` de assinaturas. Endpoint `/api/billing/webhook`; habilitar checkout, atualização/exclusão de assinatura e eventos de fatura usados pela implementação. Configure portal em sandbox. Não aceitar Price IDs desconhecidos.
- **Vista/IPTU:** `VISTA_KEY_SECRET` aleatório para cifrar chaves; credenciais Vista pertencem à organização. O job opcional/pago `enrich-iptu` exige `INFOSIMPLES_TOKEN`. CLI e cron injetam os adapters; Curitiba exige também `INFOSIMPLES_CURITIBA_ENDPOINT`, confirmado com o fornecedor. Sem adapter, o lote registra `cobertura inexistente` e falha. O contrato Curitiba foi testado com fixtures sintéticas; cobertura, credencial e resposta reais continuam **BLOCKED**. Consulte [contrato e evidências T4](specs/iptu-curitiba.md). CLI usa cache por execução e cron usa `IPTU_CACHE`, com validade de 365 dias por CEP/número/ano. Scraping utiliza allowlist e limites por fonte; não remova políticas para passar um check.
- **GitHub:** environments `preview`, `production`, `model-training` com secrets mínimos; proteção/revisor obrigatório em production. Variáveis `WEB_URL`, `WORKER_URL` em cada environment apontam ao ambiente respectivo. R2/retraining deve usar bucket isolado até promoção aprovada.

A lista de referência está em `.env.example`. Wranglers, console Pages e build têm escopos distintos: variáveis públicas de build não substituem bindings secretos de runtime.

## Backup e migrations

1. Registrar SHA do app, versões do Worker/Pages, schema atual, counts e ativo de modelo. Criar backup/snapshot restaurável; registrar identificador fora do código. Demonstrar restauração numa branch isolada.
2. Verificar duplicatas com `SELECT listing_id, captured_at, count(*) FROM listing_snapshots GROUP BY 1,2 HAVING count(*) > 1`. Se houver, parar e investigar; não apagar histórico automaticamente.
3. Fazer preflight das migrations0001–0007 e do ledger `schema_migrations`. Instalações legadas sem ledger precisam conferir que migrations antigas são compatíveis com o schema real; não presumir que um banco já está atualizado.
4. Em staging autorizado, configurar `DATABASE_URL` apenas no terminal seguro e executar `pnpm --filter @imovi/db db:migrate`. Cada migration e checksum têm uma transação; rerun pula arquivos registrados. Checksum alterado é erro. Não executar duas migrations simultaneamente.
5. Confirmar tabelas/colunas/índices, snapshots com associações conhecidas e significado dos eventos antigos. Backfill preserva somente a última observação conhecida; snapshots antigos sem associação confiável ficam excluídos do ML.
6. Fazer backfill de medianas em staging pelo comando `aggregate-neighborhoods` da CLI. Seeds são referências iniciais e não sobrescrevem medianas observadas.

Rollback de app preserva migrations aditivas e dados novos. Reversão de schema exige decisão própria e backup, sem `DROP` automático.

## Aceite funcional em staging

Registrar evidência por critério da spec, sem segredos/PII nos logs:

- Duas organizações, owner/admin/member: isolamento, membro removido perde acesso; membro comum não configura/cobra; token de sessão inválido recusado. Signup sem sessão até verificar link; link expirado/reutilizado e resend controlado.
- Formulário com valores identificáveis: salvar UUID, comparar resposta, DTO e `/resultados?id=...`. Sem comparáveis/histórico inventados; origem seed/insuficiente/observada explícita. UUID desconhecido amigável, token Turnstile nunca persistido.
- Turnstile inválido e configuração ausente; 11 tentativas no mesmo minuto/IP com limite10 produzem `429` e `Retry-After`. Outro IP independente. Lista de espera só confirma após persistência/consentimento.
- Stripe sandbox: checkout, retorno, webhook, portal, troca de preço, cancelamento, falha/recuperação de pagamento, duplicata, entregas simultâneas, evento atrasado e interrupção entre gravações. Conferir estado no Stripe e organização; não confiar na página de sucesso.
- Scrape datado, nova observação, falha de fonte/persistência registrada; amostra distinta>=20 e recência90dias. Mesmo imóvel não atravessa treino/teste temporal. Sem teste válido, métricas não promovem.
- Derrubar dependência em staging: readiness503 e liveness responsiva. Restaurar e demonstrar retomada. Exercitar rollback de ambos os serviços sem alteração de dados.

## Checks e publicação

CI executa `checks.yml`: frozen install, lint, tipos, testes sequenciais, auditoria critical/high, Python, build Pages e bundle Worker. Não publica em push. Deploy é `workflow_dispatch` com SHA completo; repete checks para esse SHA, passa pelo environment e executa smoke somente depois da publicação.

Preview exige infraestrutura provisionada e migrations aplicadas antes de `/ready` ou smoke. Produção exige SHA atual de main, `confirm_production=true` e aprovação de environment. Smoke local: configurar `WEB_URL`, `WORKER_URL` e `node scripts/smoke.mjs`; é somente leitura (health/readiness/cidades), não substitui a jornada autenticada e sandbox.

## Recuperação de cobrança e modelo

`node scripts/replay-billing.mjs` lista somente a quantidade de eventos recuperáveis, sem efetuar POST. Com autorização para staging, `--apply` exige `DATABASE_URL`, `WEB_URL` HTTPS e `STRIPE_WEBHOOK_SECRET` do mesmo ambiente; reenvia eventos pendentes/lease expirado pelo endpoint assinado. Falha interrompe o lote; evento não concluído continua recuperável. Não alterar status manualmente para forçar sucesso.

O modelo é publicado em `versions/<versao>/` antes da ativação em banco; `current/` não é sobrescrito. Gate exige treino/teste suficiente, identidades separadas e métricas finitas. Para reverter, selecionar versão anterior já validada em transação, nunca copiar novos bytes sobre a mesma versão. Cache da aplicação é limitado e retenta falha inicial; estimador público segue heurístico até spec de runtime ONNX e prova de inferência.

## Pendências de liberação

Backup/restauração, banco real, provedores, sandbox e rollback externo devem constar nas evidências. Status local PASS não significa produção pronta. Migração do adaptador Cloudflare, ativação ML e ampliação comercial são etapas posteriores, cada uma com aceite próprio.
