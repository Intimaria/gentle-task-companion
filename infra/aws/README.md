# Infraestructura AWS (emulada y real) con OpenTofu

Aprovisiona Gentle Task Companion en dos modos, con **el mismo código** de backend
(Hono) y frontend (Next.js), solo cambia contra qué apunta:

- **Emulado**: MiniStack (compat LocalStack) en un contenedor local. Para desarrollo y
  prueba del IaC sin tocar AWS real.
- **Real**: tu cuenta AWS (`us-east-1` por defecto). Backend serverless
  (Lambda + API GW + DynamoDB + S3 + SQS + Cognito) y frontend estático por
  **S3 static website + Cloudflare**.

Recursos: DynamoDB (tabla única, PITR, SSE) · S3 media (versioning, lifecycle, SSE) ·
S3 frontend (website hosting) · SQS + DLQ · Lambda (backend, rol IAM de mínimo
privilegio) · API Gateway HTTP v2 · Cognito (User Pool + dominio + cliente + grupo) ·
Cloudflare (DNS/HTTPS) · AWS Budgets (tope $5).

---

## ⚠️ Seguridad de credenciales (leer primero)

Hay **dos contextos de credenciales**, no los mezcles:

### Modo emulado (MiniStack)

Se aísla con un **triple candado** para que nada toque AWS real por accidente:

1. Archivo de credenciales local (`.aws/`) en esta carpeta, no `~/.aws`.
2. Perfil dummy `ministack` (creds `test`/`test`; MiniStack no las valida).
3. Endpoint forzado a `http://localhost:4566`.

Además, `versions.tf` con `emulated = true` (default) fuerza los endpoints a localhost y
usa creds dummy, así `tofu` es seguro por config aparte del env.

### Modo real (AWS)

Se usa **IAM Identity Center (SSO)** — credenciales temporales, sin access keys de larga
vida. El perfil `YOUR_AWS_PROFILE` de `~/.aws/config` apunta a SSO (`sso_session`,
role `gentle-deploy`). La infra de SSO se codifica en `../bootstrap/`.

---

## Prerequisitos

- OpenTofu ≥ 1.6 (`tofu`)
- AWS CLI v2
- Node 20 + npm (buildear el bundle de la Lambda y el frontend)
- Solo emulado: Docker (MiniStack; la Lambda corre vía Docker RIE, necesita `/var/run/docker.sock`)
- Solo real: SSO configurado (`../bootstrap/`) y `aws sso login` con el perfil `YOUR_AWS_PROFILE`

---

## Modo emulado (MiniStack)

### Setup (una vez)

Los archivos locales están gitignoreados. Recrealos así:

```bash
# .envrc (plantilla versionada: .envrc.example)
cp .envrc.example .envrc
direnv allow

# credenciales locales con perfil dummy
mkdir -p .aws
cat > .aws/credentials <<'EOF'
[ministack]
aws_access_key_id = test
aws_secret_access_key = test
EOF
cat > .aws/config <<'EOF'
[profile ministack]
region = us-east-1
output = json
EOF
```

Verificá el aislamiento (debe devolver la cuenta dummy, no una real):

```bash
aws sts get-caller-identity   # → Account: 000000000000
```

### Uso

```bash
# 1) MiniStack
docker run -d --name ministack -p 4566:4566 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  ministackorg/ministack:latest

# 2) build Lambda
cd ../../backend && npm run build:lambda
cd - && rm -f lambda.zip && (cd ../../backend/dist/lambda && zip -qr "$OLDPWD/lambda.zip" .)

# 3) aprovisionar (workspace default, emulated=true por default)
tofu init
tofu workspace select default
tofu plan
tofu apply

# 4) smoke
API=$(tofu output -raw api_url)
curl "${API}companion?species=nope"
```

---

## Modo real (AWS `YOUR_AWS_PROFILE`)

### 1. Bootstrap SSO (una vez)

El módulo `../bootstrap/` crea el usuario SSO, el permission set `gentle-deploy` (policy
acotada por servicio, no `AdministratorAccess`) y la asignación a la cuenta. Se aplica
**como admin** (root o un IAM user con `ssoadmin:*`), una sola vez:

```bash
cd ../bootstrap
AWS_PROFILE=YOUR_AWS_PROFILE tofu init && AWS_PROFILE=YOUR_AWS_PROFILE tofu apply
```

Después: `aws configure sso` (perfil `YOUR_AWS_PROFILE`) y `aws sso login`. El usuario SSO
despliega la app pero **no** puede tocarse a sí mismo (el permission set no incluye
`ssoadmin:*`).

### 2. Aprovisionar la app

```bash
cd infra/aws
AWS_PROFILE=YOUR_AWS_PROFILE tofu init
AWS_PROFILE=YOUR_AWS_PROFILE tofu workspace select real   # estado separado del emulado
AWS_PROFILE=YOUR_AWS_PROFILE tofu apply -var-file=real.tfvars
```

`real.tfvars` fija `emulated = false` y el email de alerta. Sin eso, el default
`emulated = true` apunta todo a `localhost:4566` y falla (connection refused + token
inválido en CloudFront/Budgets).

El apply es **una sola fase**: las `callback_urls`/`logout_urls` de Cognito derivan del
`var.frontend_domain` (`YOUR_DOMAIN`), no hay placeholder ni two-phase.

### 3. Frontend estático → S3 + Cloudflare

```bash
# env NEXT_PUBLIC_* leídos de `tofu output` (requiere workspace real)
eval "$(./frontend-env.sh)"

# build estático (NEXT_EXPORT=1 → output "export" → out/)
cd ../../frontend && NEXT_EXPORT=1 npm run build

# subir a S3
aws s3 sync out/ s3://YOUR_DOMAIN
```

En Cloudflare (`YOUR_DOMAIN`):

1. **DNS → CNAME**: `gentle` → `YOUR_DOMAIN.s3-website-us-east-1.amazonaws.com`, **Proxied** (nube naranja).
2. **SSL/TLS → modo `Flexible`** (el endpoint de S3 website es solo HTTP).

El bucket se llama `YOUR_DOMAIN` **a propósito**: S3 website resuelve el bucket por el
`Host` header, así que el bucket debe coincidir con el dominio. Con eso no hace falta ninguna
regla de Host/Origin en Cloudflare.

Resultado: `https://YOUR_DOMAIN`.

### Budget

`budget.tf` crea `gentle-monthly`: tope **$5/mes** (COST), con alerta por email al 80%
(ACTUAL) y 100% (FORECASTED). Guarda contra anomalías (Lambda en loop, escrituras
on-demand disparadas), no contra el uso normal (que ronda centavos).

---

## Archivos

| Archivo | Rol |
|---|---|
| `versions.tf` | provider AWS (emulado vs real) + required_providers |
| `variables.tf` | endpoints, nombres, dominio, email de alerta, budget |
| `data.tf` | DynamoDB + S3 media (módulos; PITR/versioning/lifecycle/SSE) |
| `queue.tf` | SQS + DLQ (módulo) |
| `compute.tf` | Lambda + rol IAM de mínimo privilegio (módulo) |
| `auth.tf` | Cognito (pool, dominio, cliente, grupo admin) |
| `apigw.tf` | API Gateway HTTP v2 (recursos crudos) |
| `frontend.tf` | S3 website hosting público + policy (Cloudflare da HTTPS) |
| `budget.tf` | AWS Budgets (`gentle-monthly`, $5) |
| `outputs.tf` | api_url, ids, nombres, frontend_domain, website_endpoint |
| `frontend-env.sh` | emite `NEXT_PUBLIC_*` para el build del frontend |
| `real.tfvars` | valores del deploy real (`emulated=false`, email) |
| `.envrc.example` | plantilla del aislamiento MiniStack (el `.envrc` real es local) |

`../bootstrap/` (estado separado): usuario SSO + permission set `gentle-deploy` +
asignación a la cuenta.
