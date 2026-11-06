# Revisão de monetização — imovi

Data da revisão: 10/07/2026

Documento histórico. A implementação de estabilização e os gates atuais estão
na [spec](specs/stabilization/spec.md), nas [evidências](specs/stabilization/evidence.md)
e no [runbook](deploy-runbook.md). Este texto não comprova prontidão comercial atual.

## Resumo executivo

O projeto tem dois produtos com economias diferentes:

1. **AVM gratuito/B2C e profissional individual**: aquisição via SEO e estimativa gratuita. A receita adequada é publicidade contextual no gratuito e assinatura futura para relatórios, histórico e API.
2. **Auditoria B2B para imobiliárias**: ticket de R$ 149 a R$ 499/mês, trial de 14 dias e venda self-service. Aqui não deve haver publicidade; a prioridade é conversão, retenção e expansão por número de corretores.

A base técnica de autenticação multi-tenant, isolamento por organização, trial e limites já existia. Esta revisão adicionou a fundação de cobrança recorrente e de anúncios. O produto ainda **não deve ser anunciado como plenamente pronto para venda** enquanto os bloqueadores P0 abaixo não forem resolvidos.

## O que foi preparado nesta revisão

- Checkout de assinatura hospedado pela Stripe para os três planos de auditoria.
- Portal do cliente para meio de pagamento, faturas, troca/cancelamento de plano.
- Webhook com validação HMAC no runtime Edge, corpo bruto e tolerância de replay.
- Idempotência de eventos Stripe e sincronização de `customer`, `subscription`, plano, status, período e cancelamento no banco.
- Recuperação de pagamento: `past_due` não corta imediatamente o acesso; `unpaid`, `canceled` e `paused` suspendem.
- Checkout acessível mesmo após o trial expirar, sem abrir os demais dados pagos.
- Price IDs controlados no servidor por allowlist; o navegador não escolhe preço arbitrário.
- Proteção de origem nos endpoints autenticados de cobrança.
- AdSense configurável por ambiente, unidade responsiva na página gratuita e `ads.txt` dinâmico.
- Anúncios não personalizados, carregados somente após escolha explícita; nenhum anúncio na auditoria B2B.
- Política de privacidade, termos, aceite no cadastro e opção para rever preferências.
- Migration `0006_billing` e testes para planos, assinatura de webhook e idempotência.

## Bloqueadores antes de cobrar clientes

### P0 — confiança e contrato do produto

- `/resultados` exibe um relatório fictício (Batel, R$ 1,054 milhão, comparáveis e histórico inventados) mesmo quando o usuário veio de uma estimativa real.
- `/dashboard` é uma demonstração com usuário, carteira e métricas fictícios, mas não está rotulada como demo.
- A página de preços promete comparáveis, PDF, histórico, API e cidades que ainda não estão ligados a direitos de acesso reais.
- A lista de espera apenas troca o estado visual para “enviado”; nenhum contato é persistido.

Esses pontos afetam confiança, suporte, chargebacks e risco consumerista. Antes do lançamento, ligar o relatório ao resultado real, rotular ou retirar o dashboard demo, persistir leads e vender apenas funcionalidades entregues.

### P0 — operação de cobrança

- Criar produtos e preços recorrentes na Stripe e preencher os três `STRIPE_PRICE_*`.
- Configurar o webhook de produção em `/api/billing/webhook` e assinar pelo menos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed`.
- Definir com contabilidade a emissão fiscal e a estratégia de tributos antes de habilitar cálculo automático no provedor.
- Ativar e configurar o Customer Portal, política de cancelamento, recuperação de receita e e-mails de falha.
- Aplicar `0006_billing.sql` no Neon antes de publicar o código.
- Fazer um ciclo completo em sandbox: nova conta, checkout, pagamento, webhook, portal, cancelamento e falha de pagamento.

### P0 — identidade, abuso e dados

- Ativar verificação de e-mail antes de produção; hoje `requireEmailVerification` está desabilitado.
- Tornar Turnstile obrigatório em produção e adicionar rate limit por IP/conta. “Estimativas ilimitadas” sem limite operacional permite abuso e custo sem receita.
- Definir política de backup, restauração e exclusão por organização, além de trilha de aceite dos termos (hoje o checkbox não grava versão/data).
- Revisar termos e privacidade com assessoria jurídica brasileira antes do lançamento comercial.

## Modelo de planos recomendado

### AVM público

| Plano                 |         Preço sugerido | Limite e valor                                                               |
| --------------------- | ---------------------: | ---------------------------------------------------------------------------- |
| Gratuito com anúncios |                   R$ 0 | 3 estimativas/mês por navegador/IP, resultado resumido, sem PDF              |
| Corretor Pro          |           R$ 39–59/mês | 50–100 estimativas, relatório real, histórico, 20 comparáveis e sem anúncios |
| API                   | a partir de R$ 149/mês | franquia explícita, chave, rate limit, excedente medido e SLA definido       |

Não usar “ilimitado” enquanto não houver custo marginal medido e proteção contra automação. O plano gratuito deve gerar aquisição e inventário; o Pro deve remover anúncios e vender conveniência/confiabilidade.

### Auditoria B2B

Manter R$ 149 / R$ 299 / R$ 499 inicialmente, mas medir valor antes de otimizar preço. O limite por corretores já gera aviso sem descartar dados, uma boa política operacional. A expansão deve acontecer por upgrade, não por bloqueio silencioso da ingestão.

Sugestão após 10–20 clientes ativos: incluir anual com 15%–20% de desconto e reposicionar o plano Escala como “a partir de R$ 499”, pois operações grandes tendem a exigir implantação e suporte variáveis.

## Estratégia de anúncios

### Onde exibir

- Uma unidade após a estimativa gratuita, abaixo da resposta principal.
- Futuramente, uma unidade entre seções de conteúdo SEO de bairro/cidade, desde que haja conteúdo original suficiente.
- Nunca dentro do formulário, antes do resultado, perto de botões de ação ou no dashboard pago.

### Regras de experiência

- Reservar altura para evitar layout shift.
- Limitar a 1–2 unidades por página no início.
- Não usar Auto Ads até medir CLS, Core Web Vitals e conversão.
- Excluir assinantes Pro e todo o produto Auditoria.
- Começar com anúncios contextuais não personalizados. Só avaliar personalização após CMP, base legal e revisão de privacidade.

### Pré-requisitos AdSense

- Aprovar o domínio e preencher `NEXT_PUBLIC_ADSENSE_CLIENT_ID` e o slot.
- Confirmar `/ads.txt` em produção.
- Ter conteúdo real, navegação, contato, privacidade e termos acessíveis.
- Acompanhar RPM, viewability, CLS e queda na conclusão de estimativas. Receita publicitária não deve reduzir a geração de leads B2B.

## Métricas mínimas

### Funil AVM

- visitas → formulário iniciado → estimativa concluída;
- custo por estimativa, erros por etapa e taxa de Turnstile;
- visualização e RPM de anúncio;
- gratuito → cadastro → Pro.

### Funil Auditoria

- cadastro → integração Vista concluída → primeiro insight → checkout;
- ativação em 24h, conversão trial→pago, MRR, churn, falha de pagamento recuperada;
- corretores por organização, anomalias resolvidas e tempo até primeira resolução;
- tickets e custo operacional por plano.

Eventos de produto devem usar IDs internos/pseudônimos e não enviar dados imobiliários ou pessoais para plataformas de analytics sem revisão.

## Ordem de lançamento recomendada

1. Resolver todos os P0 de confiança, verificar e-mail, rate limit e persistência de leads.
2. Aplicar migration e validar Stripe em sandbox com webhooks reais.
3. Fazer piloto B2B com 3–5 imobiliárias, cobrança inicialmente acompanhada e suporte próximo.
4. Instrumentar ativação, conversão, churn e custo antes de alterar preço.
5. Solicitar AdSense somente quando as páginas públicas tiverem resultados e conteúdo reais.
6. Ativar um único slot para 10%–20% do tráfego, comparar conversão e Core Web Vitals, então ampliar.

## Configuração operacional

Variáveis necessárias estão documentadas em `.env.example`. Em produção, guardar chaves Stripe e secret do webhook como secrets do Cloudflare, nunca como variáveis `NEXT_PUBLIC_*`. Somente o publisher ID e o slot do AdSense são públicos.

Após configurar o banco e os provedores:

```powershell
pnpm.cmd --filter @imovi/db db:migrate
pnpm.cmd --filter @imovi/web test
pnpm.cmd --filter @imovi/web typecheck
pnpm.cmd --filter @imovi/web build
```
