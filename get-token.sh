#!/usr/bin/env bash
# Dev-only: obtiene un token del emisor OIDC de desarrollo (mock-oidc) desde el HOST
# (localhost:8081), para que el claim `iss` coincida con http://localhost:8081/default,
# que es lo que valida el backend. Sirve para el smoke del backend por curl (grant
# client_credentials). El navegador usa el flujo authorization_code (login interactivo).
# Producción usa Cognito (AWS) o Authentik (self-host) — este script NO aplica ahí.
set -euo pipefail
resp=$(curl -s -X POST http://localhost:8081/default/token \
  -d grant_type=client_credentials \
  -d client_id=gentle \
  -d client_secret=gentle-dev-secret \
  -d scope=openid)
printf '%s' "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])"
