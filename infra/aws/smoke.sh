#!/usr/bin/env bash
# Smoke end-to-end del build AWS-emulado: crea un usuario admin en Cognito, saca un token,
# y verifica rutas pública/datos/protegida por API Gateway → Lambda → DynamoDB/Cognito.
# Requiere: MiniStack arriba (docker compose -f docker-compose.aws.yml up -d ministack) y
# `tofu apply` hecho. Correr desde infra/aws/.
set -euo pipefail
cd "$(dirname "$0")"

# Env seguro (por si direnv no está activo): perfil dummy + endpoint a MiniStack.
export AWS_SHARED_CREDENTIALS_FILE="$PWD/.aws/credentials" AWS_CONFIG_FILE="$PWD/.aws/config"
export AWS_PROFILE=ministack AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1
export AWS_ENDPOINT_URL=http://localhost:4566 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test
unset AWS_SESSION_TOKEN || true

POOL=$(tofu output -raw user_pool_id)
CLIENT=$(tofu output -raw cognito_client_id)
API=$(tofu output -raw api_url)
echo "pool=$POOL  client=$CLIENT  api=$API"

# Usuario admin idempotente (crear + password permanente + grupo admin).
aws cognito-idp admin-create-user --user-pool-id "$POOL" --username admin --message-action SUPPRESS >/dev/null 2>&1 || true
aws cognito-idp admin-set-user-password --user-pool-id "$POOL" --username admin --password "Passw0rd!" --permanent >/dev/null
aws cognito-idp admin-add-user-to-group --user-pool-id "$POOL" --username admin --group-name admin >/dev/null 2>&1 || true

TOK=$(aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id "$CLIENT" \
  --auth-parameters USERNAME=admin,PASSWORD="Passw0rd!" --query 'AuthenticationResult.IdToken' --output text)

pass() { echo "  ✔ $1"; }
check() { # descripcion, url, codigo_esperado, [auth]
  local code
  if [ "${4:-}" = "auth" ]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 40 "$2" -H "Authorization: Bearer $TOK")
  else
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 40 "$2")
  fi
  [ "$code" = "$3" ] && pass "$1 → $code" || { echo "  x $1 → $code (esperado $3)"; exit 1; }
}

echo "== smoke =="
check "público  GET /media"                 "${API}media"                 200
check "público  GET /companion?species=nope" "${API}companion?species=nope" 400
check "protegido GET /admin/whoami (token)"  "${API}admin/whoami"          200 auth
check "protegido GET /admin/whoami (sin tok)" "${API}admin/whoami"         401
echo "OK ✅  backend AWS-emulado end-to-end (Cognito + API GW + Lambda + DynamoDB)"
