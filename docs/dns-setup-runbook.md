# Runbook: DNS Setup `imovi.app.br` (Registro.br + Cloudflare)

Ordem de execução pensada pra minimizar downtime e permitir trabalho em paralelo
enquanto o DNS propaga. Passos 1–2 são sequenciais; 3 depende da propagação; 4
pode rodar em paralelo com 2.

---

## Passo 1 — Adicionar o domínio na Cloudflare

1. Entrar em <https://dash.cloudflare.com>
2. **Add a Site** → digitar `imovi.app.br` → selecionar plano **Free**
3. A Cloudflare escaneia DNS existente (não vai achar nada — normal) → **Continue**
4. Anotar os 2 nameservers exibidos (formato `xxx.ns.cloudflare.com` /
   `yyy.ns.cloudflare.com`). **Cada conta recebe nameservers próprios.**

| Campo            | Valor                      |
| ---------------- | -------------------------- |
| Nameserver 1     | `_______________________`  |
| Nameserver 2     | `_______________________`  |
| Data/hora add    | `_______________________`  |

---

## Passo 2 — Trocar nameservers no Registro.br

1. Login em <https://registro.br>
2. **Meus Domínios** → clicar em `imovi.app.br`
3. Aba **DNS** → **Alterar Servidores DNS** (ou "Usar servidores DNS de terceiros")
4. Colar os 2 nameservers anotados no Passo 1
5. **Salvar**

**Propagação esperada:** ~15 min típico, até 24h no pior caso. Status na
Cloudflare fica **Pending** até detectar a mudança.

Para checar propagação sem depender do dashboard, usar
`scripts/check-dns-propagation.sh` (ver Passo 5).

---

## Passo 3 — Configurar custom domain no Pages

**Pré-requisito:** Cloudflare confirmou ativação do domínio (email "Your site is
now active on Cloudflare" ou status **Active** no dashboard).

1. Cloudflare Dashboard → **Workers & Pages** → `imovi-web` → aba **Custom domains**
2. **Set up a custom domain** → `imovi.app.br` → Continue → **Activate**
3. Repetir para `www.imovi.app.br`

A Cloudflare cria os registros DNS (CNAME) e provisiona SSL automaticamente.
Leva ~5 min pro certificado ficar pronto.

Checar com: `curl -I https://imovi.app.br` — esperado `HTTP/2 200` e header
`cf-ray`.

---

## Passo 4 — Turnstile (pode rodar em paralelo com Passo 2)

Enquanto o DNS propaga, criar as chaves Turnstile.

### 4a. Criar site no Turnstile

1. Cloudflare Dashboard → **Turnstile** → **Add site**
2. Nome: `imovi-app-br`
3. Hostnames:
   - `imovi.app.br`
   - `www.imovi.app.br`
   - `imovi-web.pages.dev` (pra dev/preview)
4. Widget mode: **Managed**
5. Copiar **Site Key** e **Secret Key**

| Campo      | Valor                      |
| ---------- | -------------------------- |
| Site Key   | `_______________________`  |
| Secret Key | `_______________________`  |

### 4b. Env vars no Pages

Workers & Pages → `imovi-web` → **Settings** → **Environment variables**.
Adicionar em **Production** E **Preview**:

| Nome                               | Valor      | Type        |
| ---------------------------------- | ---------- | ----------- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`   | Site Key   | Plaintext   |
| `TURNSTILE_SECRET`                 | Secret Key | **Encrypted** |

> **Importante:** o nome bate exatamente com o que o código espera
> (`apps/web/src/env.d.ts` + `apps/web/src/app/api/estimate/route.ts`). Se
> errar o nome, o server-side cai no fallback "dev mode" e emite warning 1x:
> `[api/estimate] TURNSTILE_SECRET ausente — validação anti-bot desabilitada (dev).`
> Isso indica var mal configurada em prod.

### 4c. Redeploy

Depois de salvar as env vars, **fazer redeploy** do Pages (ou trigger um novo
deploy via git push). Env vars não se aplicam retroativamente a deploys
existentes.

---

## Passo 5 — Verificação

Rodar `scripts/check-dns-propagation.sh` após cada etapa relevante.

Checklist final (marcar conforme for concluindo):

- [ ] Domínio **Active** na Cloudflare
- [ ] `dig NS imovi.app.br` retorna os 2 nameservers Cloudflare
- [ ] `curl -I https://imovi.app.br` retorna 200 + `cf-ray` header
- [ ] `curl -I https://www.imovi.app.br` retorna 200 + `cf-ray` header
- [ ] Abrir `https://imovi.app.br` no browser — widget Turnstile renderiza
- [ ] Submeter formulário de estimate — sem erro `turnstile_failed`
- [ ] Logs do Pages **sem** warning `TURNSTILE_SECRET ausente`

---

## Troubleshooting

| Sintoma                                         | Causa provável                                      | Correção                                                    |
| ----------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| Cloudflare fica "Pending" > 2h                  | Nameservers não foram salvos no Registro.br         | Re-conferir no Registro.br, salvar de novo                  |
| `curl` retorna 525/526                          | SSL ainda provisionando                             | Esperar ~5 min; se persistir, trigger re-provision no Pages |
| Form retorna `turnstile_failed` em prod         | `TURNSTILE_SECRET` ausente ou errado no Pages       | Conferir env var + redeploy                                 |
| Widget Turnstile não renderiza                  | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` ausente            | Conferir env var + redeploy (precisa ser NEXT_PUBLIC_)      |
| Turnstile bloqueia todo request                 | Hostname não está na lista do site Turnstile        | Adicionar hostname em Turnstile → site → Settings           |

---

## Referências rápidas

- Código Turnstile client: `apps/web/src/app/estimate-form.tsx`
- Código Turnstile server: `apps/web/src/app/api/estimate/route.ts:22-82`
- Env vars declaradas: `apps/web/src/env.d.ts`
- README do app: `apps/web/README.md`
