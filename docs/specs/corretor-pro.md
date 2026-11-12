# T7 — Corretor Pro e API: spec e direitos de acesso

Data: 05/11/2026 (atualizado em 12/11/2026). Status: **Fase 1 concluída e integrada (`8addd4b`)**; aguarda Gate G3 (Stripe sandbox) para ciclo de cobrança externa (T7d).
Depende de: T3 (concluída), G3 (Stripe sandbox) para cobrar de verdade.
Referências: [PLANO-UNIFICADO.md](PLANO-UNIFICADO.md), [../monetization-readiness.md](../monetization-readiness.md).

## 1. Objetivo

Vender um plano individual para corretores (Corretor Pro) e, depois, uma API de estimativas, **sem
anunciar nada que não esteja ligado a um direito de acesso verificado no servidor**. A página
`/precos` só ganha o card do Pro quando os critérios de aceite da fase 1 estiverem verdes.

## 2. Estado atual do código (05/11/2026)

- Estimativa pública: heurística (`@imovi/ml-infer/heuristic`), sem login, com Turnstile e limite
  anti-abuso por IP/minuto (`ESTIMATE_RATE_LIMIT_PER_MINUTE`, padrão 10) em `api_rate_limits`.
- `api_rate_limits` é janela de **1 minuto** e é podada após 1 dia: não serve para cota mensal.
- Cobrança: Stripe por **organização** (`organizations.plan/status`, checkout, portal, webhook com
  lease). `BILLING_PLANS` só tem os três planos da Auditoria; `assertOrgAccess` libera a Auditoria
  para qualquer org `trial|active|past_due`, sem olhar o produto.
- Anúncios: `AdSlot` só na home, depois do consentimento; não existe noção de assinante.
- Dados de mercado: o último scrape em produção é de 11/06/2026 (verificado no Neon). Comparáveis e
  histórico de preços **não** podem ser vendidos até a coleta voltar e ser validada.

## 3. Escopo por fase

### Fase 1 — Corretor Pro (vender só isto)

| Direito                            | Como é garantido no servidor                                        |
| ---------------------------------- | ------------------------------------------------------------------- |
| Cota mensal de estimativas (N)     | Contador mensal por conta, atômico, consumido em `/api/estimate`    |
| Sem anúncios                       | `GET /api/me/entitlements` → `ads: false`; `AdSlot` não renderiza   |
| Histórico das próprias estimativas | `price_estimates.owner_user_id` + página `/conta/estimativas`       |
| Sem Turnstile a cada estimativa    | Sessão autenticada substitui o desafio (mantém o limite por minuto) |

Fora da fase 1: PDF, comparáveis, histórico de preços de mercado, API, múltiplos usuários.

### Fase 2 — Relatório em PDF (só depois da fase 1 em produção)

### Fase 3 — API de estimativas

Chaves por organização (prefixo visível + hash SHA-256; o segredo aparece uma única vez), franquia
mensal explícita, limite por minuto, excedente medido e SLA escrito. Mesma tabela de uso da fase 1.

## 4. Modelo de dados (migration `0009_entitlements`)

1. **Produto do plano.** Cada plano em `BILLING_PLANS` ganha `product: 'audit' | 'corretor_pro' |
'api'` e `entitlements` (cota, `ads`, `history`). O Pro é uma organização de um membro, criada no
   cadastro do Pro, para reaproveitar checkout, portal e webhook existentes sem um segundo fluxo.
2. **`assertOrgAccess` passa a receber o produto exigido.** A Auditoria exige `product = 'audit'`;
   uma org Pro nunca abre `/auditoria` (correção de segurança que precisa estar no mesmo PR).
3. **`usage_counters`**: `(org_id, metric, period_start)` único, `count`, `updated_at`; upsert
   atômico igual ao `rateLimitRepo.consume`, mas com período mensal (UTC, 1º dia do mês) e **sem
   poda** (é dado de cobrança; retenção pelo prazo fiscal).
4. **`price_estimates.owner_user_id`** (nulo para anônimos, FK `users` com `ON DELETE SET NULL`).

## 5. Regras de comportamento

- Estimativa anônima: inalterada (Turnstile + limite por IP/minuto).
- Estimativa autenticada com Pro ativo: consome 1 da cota; ao esgotar, `402 quota_exceeded` com a
  data de renovação. **Nunca** cai silenciosamente para o fluxo anônimo.
- `past_due`: mantém o direito (mesma regra da Auditoria); `suspended`/`canceled`: volta a anônimo.
- Troca de plano no portal: a cota nova vale a partir do evento do webhook, sem zerar o consumo do mês.
- Proibido o texto "ilimitado" em qualquer plano (regra do P0 de confiança).

## 6. Critérios de aceite (fase 1)

- AC-P1: org Pro não acessa nenhuma rota `/api/auditoria/*` nem `/auditoria/*` (teste de rota).
- AC-P2: 100 requisições concorrentes com cota 50 → exatamente 50 aceitas (PGlite).
- AC-P3: virada de mês UTC zera o contador sem apagar o mês anterior.
- AC-P4: assinante Pro não vê `AdSlot`; anônimo continua vendo após consentimento.
- AC-P5: `/conta/estimativas` lista só estimativas do próprio usuário (teste de isolamento).
- AC-P6: `/precos` mostra o card do Pro com preço e cota vindos de `BILLING_PLANS`; teste do
  `product-trust` cobre o card e mantém PDF/comparáveis/API em "Em breve".
- AC-P7: webhook atualiza a cota e o produto sem quebrar a idempotência existente.
- Evidência: `pnpm lint`, `pnpm typecheck`, `pnpm test`; sem cobrança real (Stripe sandbox, G3).

## 7. Decisões pendentes (usuário)

| #   | Decisão                         | Recomendação                                               |
| --- | ------------------------------- | ---------------------------------------------------------- |
| D1  | Preço do Pro                    | R$ 49/mês (meio da faixa R$ 39–59 do readiness)            |
| D2  | Cota mensal                     | 100 estimativas/mês; medir uso real antes de mexer         |
| D3  | Pro usa a heurística atual?     | Sim, com o mesmo aviso de ±30%; não vender "precisão"      |
| D4  | Lançar antes de voltar o scrape | Sim, porque a fase 1 não depende de dados de mercado novos |

## 8. Quebra em tarefas

| ID  | Tarefa                                                                                      | Executor sugerido   | Depende de |
| --- | ------------------------------------------------------------------------------------------- | ------------------- | ---------- |
| T7a | `0009`, `usage_counters`, `product` nos planos, `assertOrgAccess` por produto (TDD, PGlite) | Codex (backend TDD) | D1, D2     |
| T7b | Cota em `/api/estimate`, `owner_user_id`, `GET /api/me/entitlements`                        | Codex               | T7a        |
| T7c | UI: cadastro do Pro, `/conta/estimativas`, `AdSlot` condicional, card em `/precos`          | Claude ou Gemini    | T7b        |
| T7d | Ciclo Stripe sandbox do Pro (checkout → webhook → portal → cancelamento)                    | Usuário + Claude    | T7c, G3    |
| T7e | API de estimativas (fase 3)                                                                 | Spec própria        | T7d        |

A `0009` é exclusiva da T7a. Nenhuma tarefa da T7 mexe em `pnpm-lock.yaml` (dono atual: T2).
