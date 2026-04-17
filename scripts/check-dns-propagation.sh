#!/usr/bin/env bash
# check-dns-propagation.sh
#
# Verifica estado do DNS + SSL de imovi.app.br durante a migração pra Cloudflare.
# Seguro rodar quantas vezes quiser — apenas lê, não muda nada.
#
# Uso:
#   ./scripts/check-dns-propagation.sh              # checa imovi.app.br
#   ./scripts/check-dns-propagation.sh mydomain.br  # checa outro domínio

set -euo pipefail

DOMAIN="${1:-imovi.app.br}"
WWW_DOMAIN="www.${DOMAIN}"

# Cores (desliga se não for TTY)
if [ -t 1 ]; then
  GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; YELLOW=$'\033[0;33m'; BLUE=$'\033[0;34m'; RESET=$'\033[0m'
else
  GREEN=""; RED=""; YELLOW=""; BLUE=""; RESET=""
fi

ok()   { echo "${GREEN}✓${RESET} $1"; }
fail() { echo "${RED}✗${RESET} $1"; }
warn() { echo "${YELLOW}!${RESET} $1"; }
info() { echo "${BLUE}›${RESET} $1"; }

section() {
  echo
  echo "${BLUE}━━━ $1 ━━━${RESET}"
}

# ------------------------------------------------------------------
# 1. Nameservers — devem ser *.ns.cloudflare.com depois do Passo 2.
# ------------------------------------------------------------------
section "Nameservers de ${DOMAIN}"

NS_OUTPUT=$(dig +short NS "${DOMAIN}" 2>/dev/null || true)

if [ -z "$NS_OUTPUT" ]; then
  fail "Nenhum nameserver retornado (dig NS ${DOMAIN})"
else
  echo "$NS_OUTPUT" | sed 's/^/    /'
  if echo "$NS_OUTPUT" | grep -qi 'ns.cloudflare.com'; then
    ok "Nameservers Cloudflare detectados — propagação OK"
  elif echo "$NS_OUTPUT" | grep -qi 'registro.br'; then
    warn "Ainda nos nameservers do Registro.br — aguardando propagação"
  else
    warn "Nameservers não-Cloudflare detectados — verificar Passo 2 do runbook"
  fi
fi

# ------------------------------------------------------------------
# 2. A/AAAA/CNAME — Cloudflare proxy usa IPs 104.x / 172.x
# ------------------------------------------------------------------
section "Registros A/CNAME"

for host in "${DOMAIN}" "${WWW_DOMAIN}"; do
  A=$(dig +short A "$host" 2>/dev/null | head -5)
  CNAME=$(dig +short CNAME "$host" 2>/dev/null | head -1)
  if [ -n "$CNAME" ]; then
    info "$host  CNAME → $CNAME"
  fi
  if [ -n "$A" ]; then
    echo "$A" | while read -r ip; do
      if [[ "$ip" =~ ^104\.|^172\.(6[4-9]|7[0-5])\. ]]; then
        ok "$host  A $ip (Cloudflare edge)"
      else
        warn "$host  A $ip (não-Cloudflare)"
      fi
    done
  else
    if [ -z "$CNAME" ]; then
      fail "$host — sem A/CNAME resolvido"
    fi
  fi
done

# ------------------------------------------------------------------
# 3. HTTPS — SSL + cabeçalhos Cloudflare
# ------------------------------------------------------------------
section "HTTPS + SSL"

for host in "${DOMAIN}" "${WWW_DOMAIN}"; do
  # -I = HEAD, --max-time pra não travar, -s silencia progresso, -k segue redirects mas aceita self-signed temporariamente
  HEADERS=$(curl -sI --max-time 10 "https://${host}" 2>&1 || echo "CURL_FAIL")
  if echo "$HEADERS" | grep -q "CURL_FAIL"; then
    fail "https://${host} — conexão falhou"
    continue
  fi

  STATUS=$(echo "$HEADERS" | awk 'NR==1{print $2}')
  CF_RAY=$(echo "$HEADERS" | grep -i '^cf-ray:' || true)
  SERVER=$(echo "$HEADERS" | grep -i '^server:' || true)

  case "$STATUS" in
    200|301|302|308)
      if [ -n "$CF_RAY" ]; then
        ok "https://${host} — HTTP $STATUS (Cloudflare, $(echo $CF_RAY | tr -d '\r'))"
      else
        warn "https://${host} — HTTP $STATUS mas SEM cf-ray header"
      fi
      ;;
    52[0-6])
      fail "https://${host} — HTTP $STATUS (Cloudflare erro de origem — Pages ainda não linkado?)"
      ;;
    "")
      fail "https://${host} — sem resposta HTTP parseável"
      ;;
    *)
      warn "https://${host} — HTTP $STATUS"
      ;;
  esac
done

# ------------------------------------------------------------------
# 4. Resumo
# ------------------------------------------------------------------
echo
info "Para detalhes completos: dig ${DOMAIN} ANY   ou   curl -v https://${DOMAIN}"
info "Runbook: docs/dns-setup-runbook.md"
