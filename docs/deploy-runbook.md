# Imovi — Deploy Runbook (Cloudflare + Neon + GitHub)

Este documento é o passo-a-passo para executar **no seu terminal Windows** (PowerShell ou Git Bash).
Execute na ordem. Os arquivos de configuração já foram criados no repositório.

---

## Pré-requisitos instalados

```powershell
node --version   # >= 22
pnpm --version   # >= 9
```

---

## Passo 1 — Validar acesso Cloudflare

```powershell
# Se CLOUDFLARE_API_TOKEN já está no env do usuário Windows, só execute:
cd C:\unkownimbo
pnpm dlx wrangler whoami
```

**Saída esperada:**
```
Getting User settings...
👋 You are logged in with an API Token, associated with the email <seu-email>!

┌──────────────────────┬──────────────────────────────────┐
│ Account Name         │ Account ID                       │
├──────────────────────┼──────────────────────────────────┤
│ <seu-account>        │ <account-id-32-chars>            │
└──────────────────────┴──────────────────────────────────┘
```

**Anote o `Account ID`** — vai ser necessário nos próximos passos.

### Se falhar (401 / "Not Authenticated"):

O token precisa das seguintes permissões:
- `Account > Cloudflare Pages: Edit`
- `Account > Workers Scripts: Edit`
- `Account > Account Settings: Read`
- `Account > Workers KV Storage: Edit`
- `Account > R2 Storage: Edit`

Recrie em: https://dash.cloudflare.com/profile/api-tokens → "Create Token" → "Edit Cloudflare Workers" template, adicione Pages e R2.

```powershell
# Depois de recriar, setar no PowerShell:
$env:CLOUDFLARE_API_TOKEN = "novo-token"
pnpm dlx wrangler whoami
```

---

## Passo 2 — Provisionar Neon

### 2a. Obter API Key Neon
Acesse: https://console.neon.tech/app/settings/api-keys → "Create Key"

### 2b. Rodar o script de setup

```powershell
# PowerShell (Windows nativo):
cd C:\unkownimbo
$env:NEON_API_KEY = "sua-api-key-neon"
.\scripts\setup-neon.ps1
```

O script vai:
1. Criar projeto `imovi-prod` em `aws-us-east-2`
2. Criar branch `main` (padrão) e branch `preview`
3. Tentar aplicar `packages/db/migrations/0001_initial.sql`
4. Gravar `DATABASE_URL` em `.env.local`

### 2c. Aplicar migration manualmente (se psql não estiver disponível)

```powershell
# Instalar psql via chocolatey (se necessário):
# choco install postgresql --params '/Password:dummy'

# Aplicar migration:
$DATABASE_URL = (Get-Content .env.local | Where-Object { $_ -match "^DATABASE_URL=" }) -replace "^DATABASE_URL=",""
psql $DATABASE_URL -f packages/db/migrations/0001_initial.sql
```

---

## Passo 3 — Criar recursos Cloudflare (KV + R2)

```powershell
cd C:\unkownimbo

# KV Namespace para IPTU cache
pnpm dlx wrangler kv namespace create IPTU_CACHE
pnpm dlx wrangler kv namespace create IPTU_CACHE --preview
# → Anote os IDs retornados

# R2 Bucket para snapshots HTML
pnpm dlx wrangler r2 bucket create html-snapshots
```

**Atualizar os IDs nos wrangler.toml:**

Em `apps/worker/wrangler.toml` e `apps/web/wrangler.toml`, substituir:
```toml
[[kv_namespaces]]
binding    = "IPTU_CACHE"
id         = "REPLACE_WITH_KV_ID"        # ← colar ID real aqui
preview_id = "REPLACE_WITH_KV_PREVIEW_ID" # ← colar preview ID aqui
```

---

## Passo 4 — Configurar secret DATABASE_URL no Worker

```powershell
cd C:\unkownimbo\apps\worker

# Vai pedir para digitar o valor (não aparece no terminal)
pnpm dlx wrangler secret put DATABASE_URL
# Cole a DATABASE_URL do .env.local quando solicitado
```

---

## Passo 5 — Criar projeto Cloudflare Pages

```powershell
cd C:\unkownimbo\apps\web

# Instalar dependências do apps/web
cd C:\unkownimbo
pnpm install

# Build do apps/web para CF Pages
pnpm turbo run build --filter=@imovi/web^...
cd apps/web && pnpm build:cf

# Criar projeto Pages (só na primeira vez)
pnpm dlx wrangler pages project create imovi-web --production-branch=main

# Deploy de smoke test
pnpm dlx wrangler pages deploy .vercel/output/static --project-name=imovi-web
```

**A URL `.pages.dev` aparece na saída do deploy.**

---

## Passo 6 — Smoke test do Worker

```powershell
cd C:\unkownimbo

# Build de todos os pacotes + worker
pnpm turbo run build --filter=@imovi/worker...

# Deploy do worker
cd apps/worker
pnpm dlx wrangler deploy

# Confirmar que está up:
pnpm dlx wrangler tail imovi-worker
# Em outro terminal, disparar manualmente:
pnpm dlx wrangler cron trigger imovi-worker
```

---

## Passo 7 — Criar repo GitHub e configurar secrets

```powershell
cd C:\unkownimbo

# Autenticar (se GITHUB_TOKEN está no env, gh usa automaticamente)
gh auth status

# Criar repo privado
gh repo create imovi --private --source=. --remote=origin --push

# OU se o repo já existir mas sem remote:
git remote add origin https://github.com/<seu-usuario>/imovi.git
git branch -M main
git push -u origin main

# Configurar os 3 secrets obrigatórios
gh secret set CLOUDFLARE_API_TOKEN
# → cole o token quando solicitado

gh secret set CLOUDFLARE_ACCOUNT_ID
# → cole o account ID do passo 1

gh secret set DATABASE_URL
# → cole a DATABASE_URL do .env.local
```

---

## Passo 8 — Verificar CI/CD

Após o push em `main`, o workflow `deploy.yml` vai disparar automaticamente.

```powershell
# Acompanhar:
gh run watch
```

Dois jobs devem ficar verdes:
- `Deploy → Cloudflare Pages (apps/web)`
- `Deploy → Cloudflare Worker (apps/worker)`

---

## Checklist final

| Item                            | Comando de verificação                          |
|---------------------------------|-------------------------------------------------|
| CF account_id                   | `pnpm dlx wrangler whoami`                      |
| Neon projeto criado             | `curl https://console.neon.tech/api/v2/projects -H "Authorization: Bearer $NEON_API_KEY"` |
| Migration aplicada              | `psql $DATABASE_URL -c "\dt"`                   |
| KV IDs nos wrangler.toml        | grep `REPLACE_WITH_KV_ID` apps/*/wrangler.toml  |
| Worker deployado                | `pnpm dlx wrangler deployments list imovi-worker` |
| Pages deployado                 | URL `https://imovi-web.pages.dev`               |
| GitHub secrets configurados     | `gh secret list`                               |

---

## Arquivos criados neste setup

```
apps/worker/wrangler.toml          ← Worker config (crons, KV, R2)
apps/web/package.json              ← Next.js 15 + @cloudflare/next-on-pages
apps/web/next.config.mjs           ← Config CF-compat (edge, no Image Optimization)
apps/web/wrangler.toml             ← Pages config
apps/web/tsconfig.json
apps/web/src/app/layout.tsx        ← Layout raiz
apps/web/src/app/page.tsx          ← Página home (runtime edge)
.github/workflows/deploy.yml       ← CI/CD (deploy-pages + deploy-worker)
.env.example                       ← Template de variáveis
scripts/setup-neon.sh              ← Provisiona Neon via API
docs/deploy-runbook.md             ← Este arquivo
```

> **Lembre:** `.env.local` está no `.gitignore` e nunca deve ser commitado.
