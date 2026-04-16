#!/usr/bin/env bash
# =============================================================================
# setup-neon.sh — Provisiona o projeto Neon "imovi-prod"
#
# Pré-requisitos:
#   - NEON_API_KEY exportado no ambiente
#     (obtido em: https://console.neon.tech/app/settings/api-keys)
#   - curl + jq instalados
#
# Uso:
#   export NEON_API_KEY="<sua-key>"
#   bash scripts/setup-neon.sh
#
# O script imprime DATABASE_URL ao final. Copie para .env.local
# =============================================================================

set -euo pipefail

NEON_API="https://console.neon.tech/api/v2"
PROJECT_NAME="imovi-prod"
# sa-east-1 não está disponível no free tier da Neon — usar aws-us-east-2
REGION="aws-us-east-2"
PG_VERSION=16

echo "→ Criando projeto Neon '${PROJECT_NAME}' em ${REGION}..."

PROJECT_RESPONSE=$(curl -s -X POST "${NEON_API}/projects" \
  -H "Authorization: Bearer ${NEON_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"project\": {
      \"name\": \"${PROJECT_NAME}\",
      \"region_id\": \"${REGION}\",
      \"pg_version\": ${PG_VERSION},
      \"branch\": {
        \"name\": \"main\"
      }
    }
  }")

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.project.id')
if [ "$PROJECT_ID" = "null" ] || [ -z "$PROJECT_ID" ]; then
  echo "ERRO: Falha ao criar projeto. Resposta:" >&2
  echo "$PROJECT_RESPONSE" | jq . >&2
  exit 1
fi

echo "✓ Projeto criado — ID: ${PROJECT_ID}"

# Obter a connection string da branch main (já criada junto com o projeto)
MAIN_BRANCH_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.branch.id')
DB_NAME="neondb"
ROLE_NAME=$(echo "$PROJECT_RESPONSE" | jq -r '.roles[0].name // "neondb_owner"')

CONNECTION_RESPONSE=$(curl -s "${NEON_API}/projects/${PROJECT_ID}/connection_uri?branch_id=${MAIN_BRANCH_ID}&database_name=${DB_NAME}&role_name=${ROLE_NAME}&pooled=true" \
  -H "Authorization: Bearer ${NEON_API_KEY}")

DATABASE_URL=$(echo "$CONNECTION_RESPONSE" | jq -r '.uri')

if [ "$DATABASE_URL" = "null" ] || [ -z "$DATABASE_URL" ]; then
  echo "ERRO: Falha ao obter connection string." >&2
  echo "$CONNECTION_RESPONSE" | jq . >&2
  exit 1
fi

echo "✓ DATABASE_URL (main, pooled) obtida"

# --------------------------------------------------------------------------
# Criar branch "preview" para PRs
# --------------------------------------------------------------------------
echo "→ Criando branch 'preview'..."

PREVIEW_RESPONSE=$(curl -s -X POST "${NEON_API}/projects/${PROJECT_ID}/branches" \
  -H "Authorization: Bearer ${NEON_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"branch\": {
      \"name\": \"preview\",
      \"parent_id\": \"${MAIN_BRANCH_ID}\"
    },
    \"endpoints\": [{ \"type\": \"read_write\" }]
  }")

PREVIEW_BRANCH_ID=$(echo "$PREVIEW_RESPONSE" | jq -r '.branch.id')
if [ "$PREVIEW_BRANCH_ID" = "null" ] || [ -z "$PREVIEW_BRANCH_ID" ]; then
  echo "AVISO: Falha ao criar branch preview (pode já existir)." >&2
else
  echo "✓ Branch 'preview' criada — ID: ${PREVIEW_BRANCH_ID}"
fi

# --------------------------------------------------------------------------
# Aplicar migration 0001_initial.sql na branch main
# --------------------------------------------------------------------------
echo "→ Aplicando migration packages/db/migrations/0001_initial.sql..."

# Precisa de psql. Se não estiver disponível, instrui o usuário.
if ! command -v psql &>/dev/null; then
  echo ""
  echo "⚠️  psql não encontrado. Aplique a migration manualmente:"
  echo ""
  echo "   psql \"\${DATABASE_URL}\" -f packages/db/migrations/0001_initial.sql"
  echo ""
else
  psql "${DATABASE_URL}" -f packages/db/migrations/0001_initial.sql
  echo "✓ Migration aplicada"
fi

# --------------------------------------------------------------------------
# Salvar no .env.local (nunca commitar este arquivo — está no .gitignore)
# --------------------------------------------------------------------------
ENV_FILE=".env.local"
# Remove linha anterior se existir
grep -v "^DATABASE_URL=" "${ENV_FILE}" > "${ENV_FILE}.tmp" 2>/dev/null || true
echo "DATABASE_URL=${DATABASE_URL}" >> "${ENV_FILE}.tmp"
mv "${ENV_FILE}.tmp" "${ENV_FILE}"

echo ""
echo "============================================================"
echo "✅  Setup Neon concluído!"
echo ""
echo "  Projeto : ${PROJECT_NAME}"
echo "  ID      : ${PROJECT_ID}"
echo "  Região  : ${REGION}"
echo "  .env.local atualizado com DATABASE_URL"
echo ""
echo "Próximos passos (no seu terminal):"
echo "  1. Configurar secret no Cloudflare Worker:"
echo "       cd apps/worker && npx wrangler secret put DATABASE_URL"
echo "  2. Configurar secret no GitHub:"
echo "       gh secret set DATABASE_URL < <(grep DATABASE_URL .env.local | cut -d= -f2-)"
echo "============================================================"
