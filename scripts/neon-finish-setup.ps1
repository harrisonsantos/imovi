# =============================================================================
# neon-finish-setup.ps1 — Cria branch preview + aplica migration via API Neon
#
# Uso:
#   $env:NEON_API_KEY = "sua-api-key"
#   .\scripts\neon-finish-setup.ps1
# =============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$NEON_API  = "https://console.neon.tech/api/v2"
$PROJECT_ID = "wandering-sea-53511196"

if (-not $env:NEON_API_KEY) {
    Write-Error "NEON_API_KEY não está definido."
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $env:NEON_API_KEY"
    "Content-Type"  = "application/json"
}

# --------------------------------------------------------------------------
# Obter branch main
# --------------------------------------------------------------------------
Write-Host "→ Obtendo branch main..." -ForegroundColor Cyan
$branchesResp = Invoke-RestMethod -Method Get `
    -Uri "$NEON_API/projects/$PROJECT_ID/branches" -Headers $headers

$mainBranch = $branchesResp.branches | Where-Object { $_.name -eq "main" } | Select-Object -First 1
if (-not $mainBranch) {
    Write-Error "Branch 'main' não encontrada no projeto $PROJECT_ID"
    exit 1
}
$mainBranchId = $mainBranch.id
Write-Host "✓ Branch main — ID: $mainBranchId" -ForegroundColor Green

# --------------------------------------------------------------------------
# Criar branch preview (com retry)
# --------------------------------------------------------------------------
$previewExists = $branchesResp.branches | Where-Object { $_.name -eq "preview" }
if ($previewExists) {
    Write-Host "✓ Branch 'preview' já existe — ID: $($previewExists.id)" -ForegroundColor Green
} else {
    Write-Host "→ Criando branch 'preview' (aguardando projeto ficar livre)..." -ForegroundColor Cyan
    Start-Sleep -Seconds 5

    $previewBody = @{
        branch    = @{ name = "preview"; parent_id = $mainBranchId }
        endpoints = @(@{ type = "read_write" })
    } | ConvertTo-Json -Depth 5

    $maxRetries = 5
    $created = $false
    for ($i = 1; $i -le $maxRetries; $i++) {
        try {
            $previewResp = Invoke-RestMethod -Method Post `
                -Uri "$NEON_API/projects/$PROJECT_ID/branches" `
                -Headers $headers -Body $previewBody
            Write-Host "✓ Branch 'preview' criada — ID: $($previewResp.branch.id)" -ForegroundColor Green
            $created = $true
            break
        } catch {
            Write-Warning "Tentativa $i/$maxRetries falhou. Aguardando 8s..."
            Start-Sleep -Seconds 8
        }
    }
    if (-not $created) {
        Write-Warning "Não foi possível criar branch preview agora. Tente manualmente mais tarde."
    }
}

# --------------------------------------------------------------------------
# Aplicar migration via Neon SQL API (sem psql local)
# --------------------------------------------------------------------------
Write-Host "→ Aplicando migration 0001_initial.sql via Neon SQL API..." -ForegroundColor Cyan

$migrationPath = Join-Path $PSScriptRoot "..\packages\db\migrations\0001_initial.sql"
$sqlContent = Get-Content $migrationPath -Raw -Encoding UTF8

# Obter endpoint da branch main
$endpointsResp = Invoke-RestMethod -Method Get `
    -Uri "$NEON_API/projects/$PROJECT_ID/endpoints" -Headers $headers

$mainEndpoint = $endpointsResp.endpoints |
    Where-Object { $_.branch_id -eq $mainBranchId -and $_.type -eq "read_write" } |
    Select-Object -First 1

if (-not $mainEndpoint) {
    Write-Warning "Endpoint da branch main não encontrado. Aplique a migration manualmente:"
    Write-Host "  psql `"`$DATABASE_URL`" -f packages\db\migrations\0001_initial.sql" -ForegroundColor Yellow
} else {
    $sqlBody = @{
        query      = $sqlContent
        database   = "neondb"
    } | ConvertTo-Json -Depth 3

    try {
        $sqlResp = Invoke-RestMethod -Method Post `
            -Uri "$NEON_API/projects/$PROJECT_ID/branches/$mainBranchId/endpoints/$($mainEndpoint.id)/query" `
            -Headers $headers -Body $sqlBody
        Write-Host "✓ Migration aplicada com sucesso" -ForegroundColor Green
    } catch {
        # A Neon SQL HTTP API pode não estar no tier free — usar psql como fallback
        Write-Warning "SQL API retornou erro (pode ser limitação do plano free)."
        Write-Host ""
        Write-Host "Instale psql e aplique manualmente:" -ForegroundColor Yellow
        Write-Host "  winget install --id PostgreSQL.psql" -ForegroundColor Yellow
        Write-Host "  # Reabra o PowerShell e rode:" -ForegroundColor DarkGray
        Write-Host "  `$db = (Get-Content .env.local | Select-String '^DATABASE_URL=').ToString().Replace('DATABASE_URL=','')" -ForegroundColor Yellow
        Write-Host "  psql `"`$db`" -f packages\db\migrations\0001_initial.sql" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "✅  Setup finalizado!" -ForegroundColor Green
Write-Host "  Projeto ID : $PROJECT_ID"
Write-Host "  Branch main: $mainBranchId"
Write-Host "============================================================" -ForegroundColor Cyan
