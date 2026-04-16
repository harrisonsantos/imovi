# =============================================================================
# setup-neon.ps1 — Provisiona o projeto Neon "imovi-prod" via API REST
#
# Pré-requisito:
#   $env:NEON_API_KEY deve estar setado antes de rodar o script.
#
# Uso (PowerShell):
#   $env:NEON_API_KEY = "sua-api-key"
#   .\scripts\setup-neon.ps1
#
# A DATABASE_URL é gravada em .env.local ao final.
# =============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$NEON_API     = "https://console.neon.tech/api/v2"
$PROJECT_NAME = "imovi-prod"
$REGION       = "aws-us-east-2"   # sa-east-1 não disponível no free tier
$PG_VERSION   = 16

if (-not $env:NEON_API_KEY) {
    Write-Error "NEON_API_KEY não está definido. Rode: `$env:NEON_API_KEY = 'sua-key'"
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $env:NEON_API_KEY"
    "Content-Type"  = "application/json"
}

# --------------------------------------------------------------------------
# 1. Criar projeto
# --------------------------------------------------------------------------
Write-Host "→ Criando projeto Neon '$PROJECT_NAME' em $REGION..." -ForegroundColor Cyan

$body = @{
    project = @{
        name       = $PROJECT_NAME
        region_id  = $REGION
        pg_version = $PG_VERSION
        branch     = @{ name = "main" }
    }
} | ConvertTo-Json -Depth 5

$projectResp = Invoke-RestMethod -Method Post -Uri "$NEON_API/projects" `
    -Headers $headers -Body $body

$projectId    = $projectResp.project.id
$mainBranchId = $projectResp.branch.id
$roleName     = if ($projectResp.roles) { $projectResp.roles[0].name } else { "neondb_owner" }
$dbName       = "neondb"

Write-Host "✓ Projeto criado — ID: $projectId" -ForegroundColor Green

# --------------------------------------------------------------------------
# 2. Obter connection string (pooled) da branch main
# --------------------------------------------------------------------------
$connUri = "$NEON_API/projects/$projectId/connection_uri" +
           "?branch_id=$mainBranchId&database_name=$dbName&role_name=$roleName&pooled=true"

$connResp   = Invoke-RestMethod -Method Get -Uri $connUri -Headers $headers
$DATABASE_URL = $connResp.uri

if (-not $DATABASE_URL) {
    Write-Error "Falha ao obter connection string."
    exit 1
}

Write-Host "✓ DATABASE_URL obtida" -ForegroundColor Green

# --------------------------------------------------------------------------
# 3. Criar branch "preview"
# --------------------------------------------------------------------------
Write-Host "→ Criando branch 'preview'..." -ForegroundColor Cyan

$previewBody = @{
    branch    = @{ name = "preview"; parent_id = $mainBranchId }
    endpoints = @(@{ type = "read_write" })
} | ConvertTo-Json -Depth 5

try {
    $previewResp = Invoke-RestMethod -Method Post `
        -Uri "$NEON_API/projects/$projectId/branches" `
        -Headers $headers -Body $previewBody
    Write-Host "✓ Branch 'preview' criada — ID: $($previewResp.branch.id)" -ForegroundColor Green
} catch {
    Write-Warning "Não foi possível criar branch preview (pode já existir): $_"
}

# --------------------------------------------------------------------------
# 4. Aplicar migration 0001_initial.sql
# --------------------------------------------------------------------------
Write-Host "→ Aplicando migration packages/db/migrations/0001_initial.sql..." -ForegroundColor Cyan

$migrationFile = Join-Path $PSScriptRoot "..\packages\db\migrations\0001_initial.sql"

if (Get-Command psql -ErrorAction SilentlyContinue) {
    $env:PGPASSWORD = ""   # a URL já contém a senha
    psql $DATABASE_URL -f $migrationFile
    Write-Host "✓ Migration aplicada" -ForegroundColor Green
} else {
    Write-Warning "psql não encontrado. Aplique manualmente após instalar postgresql-client:"
    Write-Host ""
    Write-Host "  psql `"`$DATABASE_URL`" -f packages/db/migrations/0001_initial.sql" -ForegroundColor Yellow
    Write-Host ""
}

# --------------------------------------------------------------------------
# 5. Gravar DATABASE_URL no .env.local (nunca commitar)
# --------------------------------------------------------------------------
$envFile = Join-Path $PSScriptRoot "..\.env.local"

# Remove linha anterior se existir, acrescenta nova
$existing = if (Test-Path $envFile) { Get-Content $envFile } else { @() }
$filtered = $existing | Where-Object { $_ -notmatch "^DATABASE_URL=" }
$filtered + "DATABASE_URL=$DATABASE_URL" | Set-Content $envFile -Encoding UTF8

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "✅  Setup Neon concluído!" -ForegroundColor Green
Write-Host ""
Write-Host "  Projeto : $PROJECT_NAME"
Write-Host "  ID      : $projectId"
Write-Host "  Região  : $REGION"
Write-Host "  .env.local atualizado com DATABASE_URL"
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "  1. Configurar secret no Cloudflare Worker:"
Write-Host "       cd apps\worker"
Write-Host "       pnpm dlx wrangler secret put DATABASE_URL"
Write-Host "       (cole a DATABASE_URL quando solicitado)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  2. Configurar secret no GitHub (após criar o repo):"
Write-Host "       gh secret set DATABASE_URL"
Write-Host "       (cole a DATABASE_URL quando solicitado)" -ForegroundColor DarkGray
Write-Host "============================================================" -ForegroundColor Cyan
