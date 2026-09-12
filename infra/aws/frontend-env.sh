#!/usr/bin/env bash
# Emite las variables NEXT_PUBLIC_* del frontend para el build, leídas de `tofu output`.
# Sirve tanto para AWS-emulado como para AWS real (según el output `emulated`). Uso:
#   eval "$(cd infra/aws && ./frontend-env.sh)"
#   docker compose -f docker-compose.aws.yml up -d --build frontend   # emulado
# o, para AWS real: buildear el export estático y sync a S3 + invalidar CloudFront.
set -euo pipefail
cd "$(dirname "$0")"

POOL=$(tofu output -raw user_pool_id)
CLIENT=$(tofu output -raw cognito_client_id)
API=$(tofu output -raw api_url)
REGION=$(tofu output -raw region)
EMULATED=$(tofu output -raw emulated)
DOMAIN=$(tofu output -raw frontend_domain)

AUTHORITY="https://cognito-idp.${REGION}.amazonaws.com/${POOL}"

if [ "$EMULATED" = "true" ]; then
  # Split-horizon Cognito: authority = issuer formato AWS (validación); metadata = MiniStack.
  METADATA="http://localhost:4566/${POOL}/.well-known/openid-configuration"
  REDIRECT="http://localhost:3000/auth/callback"
else
  # AWS real: sin split-horizon (oidc-client-ts deriva la metadata del authority).
  # trailing slash por trailingSlash:true (S3 website hosting).
  METADATA=""
  REDIRECT="https://${DOMAIN}/auth/callback/"
fi

echo "export NEXT_PUBLIC_API_URL='${API%/}'"
echo "export NEXT_PUBLIC_OIDC_AUTHORITY='${AUTHORITY}'"
echo "export NEXT_PUBLIC_OIDC_METADATA_URL='${METADATA}'"
echo "export NEXT_PUBLIC_OIDC_CLIENT_ID='${CLIENT}'"
echo "export NEXT_PUBLIC_OIDC_REDIRECT_URI='${REDIRECT}'"
