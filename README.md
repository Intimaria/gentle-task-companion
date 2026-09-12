# Gentle Task Companion

PWA de autocuidado para personas neurodivergentes: registro de ánimo, tareas, gratitud, herramientas de crisis, y animalitos de apoyo emocional.

Desarrollada originalmente como proyecto personal y extendida en el marco del curso **Arquitectura en la Nube** de [AWS Women in Cloud Buenos Aires](https://www.meetup.com/aws-women-in-cloud-buenos-aires/) (2026), donde se migró a infraestructura serverless en AWS y se incorporaron mejoras de seguridad, resiliencia y experiencia de usuario.

El backend está escrito contra APIs portables (DynamoDB, S3, OIDC), así que el **mismo código** corre en dos configuraciones que se corren de a una por vez:

- **Self-host** (`docker-compose.yml`): ScyllaDB + MinIO + mock-oidc + backend en contenedor.
- **AWS-emulado** (`docker-compose.aws.yml` + OpenTofu): Cognito + DynamoDB + S3 + SQS + Lambda + API Gateway sobre MiniStack.

## Características

- Registro diario de ánimo, tareas (con estado) y gratitudes
- Dashboard con historial y racha de días activos
- Herramientas de crisis: temporizador de respiración, sonidos relajantes, contacto de emergencia, tarjetas de comunicación no verbal
- Compañero animal: imágenes aleatorias de gatos, perros y carpinchos; guardado de favoritos
- PWA instalable
- Internacionalización (español / inglés)
- Autenticación OIDC (Cognito en AWS, mock-oidc en self-host)

## Requisitos

- Docker y Docker Compose.
- Solo para el build AWS-emulado: OpenTofu (`tofu`), AWS CLI v2 y Node 20.

## Build 1 — Self-host

```bash
docker compose up --build
```

| Servicio | URL |
|---|---|
| Frontend (PWA) | http://localhost:3000 |
| Backend (API) | http://localhost:8080 |
| OIDC (mock) | http://localhost:8081 |
| MinIO (consola) | http://localhost:9001 |

Login con mock-oidc: cualquier usuario. Los jobs `create-table` y `create-bucket` corren automáticamente al iniciar.

```bash
docker compose down   # para frenar
```

## Build 2 — AWS-emulado (MiniStack + OpenTofu)

Instrucciones detalladas en [`infra/aws/README.md`](./infra/aws/README.md). En resumen:

```bash
docker compose -f docker-compose.aws.yml up -d ministack

cd infra/aws
direnv allow
npm --prefix ../../backend run build:lambda \
  && rm -f lambda.zip && (cd ../../backend/dist/lambda && zip -qr "$OLDPWD/lambda.zip" .)
tofu init && tofu apply
./smoke.sh

eval "$(./frontend-env.sh)"
docker compose -f ../../docker-compose.aws.yml --profile frontend up -d --build frontend
```

Abrís http://localhost:3000 y entrás por el Hosted UI de Cognito (usuario `admin`, clave `Passw0rd!`, creado por el smoke).

MiniStack es in-memory (solo S3 persiste). Si se recrea el contenedor, hay que volver a correr `tofu apply` y el smoke.

## Tests

```bash
cd backend
npm test
```

## Licencia

[PolyForm Noncommercial License 1.0.0](./LICENCE.md) — uso libre para proyectos personales, educativos y organizaciones sin fines de lucro.
