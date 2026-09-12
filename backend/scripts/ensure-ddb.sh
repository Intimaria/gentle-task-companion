#!/usr/bin/env bash
# Arranca DynamoDB Local (pinneado) para los tests de integración, idempotente.
# Usa el puerto :8001 (host) para NO chocar con ScyllaDB de la app, que usa :8000.
# Así los tests y el stack `docker compose` pueden correr al mismo tiempo.
set -euo pipefail
NAME=gentle-ddb-test
IMG=amazon/dynamodb-local:2.5.2
if [ -z "$(docker ps -q -f name="^${NAME}$")" ]; then
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker run -d --name "$NAME" -p 8001:8000 "$IMG" >/dev/null
  for _ in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001 || true)
    [ "$code" = "400" ] && break
    sleep 0.5
  done
fi
echo "DynamoDB Local ($IMG) listo en :8001 (tests; la app usa Scylla en :8000)"
