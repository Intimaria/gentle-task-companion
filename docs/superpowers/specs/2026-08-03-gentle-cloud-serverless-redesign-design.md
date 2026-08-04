# Gentle Task Companion — Rediseño serverless portable (AWS + self-hosted)

**Fecha:** 2026-08-03
**Autora:** Inti Tidball
**Contexto:** Trabajo Práctico Final — Arquitectura de Nube 2026 (AWS Women in Cloud, Buenos Aires)
**Estado:** Diseño aprobado, pendiente de plan de implementación

---

## 1. Objetivo

Modernizar **Gentle Task Companion** (app de autocuidado para personas neurodivergentes:
ánimo, tareas, gratitud, tarjetas de comunicación, sonidos, página de crisis) migrando su
backend desde Supabase — que fue una solución del momento, no sostenible — hacia una
arquitectura **serverless y portable** (corre igual en AWS o en un stack self-hosted gratuito),
y sumando un feature nuevo de **animalitos reconfortantes** basado en Lambda/S3.

El trabajo cumple dos objetivos a la vez:

1. **Mejorar la app de verdad** (backend sostenible, seguridad real, historial útil).
2. **Servir como TP** de arquitectura cloud: la misma arquitectura corre local (emulada) y
   se documenta como diseño AWS.

### Requisitos no negociables (definidos por la usuaria)

- **Login real** → autenticación OIDC. En AWS = Amazon Cognito; en self-host = Authentik/Authelia
  (mismo estándar, se cambia por config). Reemplaza la auth anónima de Supabase.
- **Cifrado TODO, in-transit y at-rest** → TLS en tránsito + cifrado at-rest (KMS en AWS; SSE de
  MinIO/Scylla + LUKS en self-host).
- **Estado persistente** → los datos se guardan y siguen ahí al volver.
- **Aislamiento real por usuaria** → nadie ve datos de otra persona.
- **Portabilidad / sin lock-in (objetivo primario)** → el MISMO código debe correr en AWS y en un
  stack self-hosted gratuito. Motivo real: no hay presupuesto para AWS en producción; la app se
  desplegará en el homelab de la autora (Proxmox/VM + Cloudflare Tunnel, o cluster k8s Talos).

---

## 2. Problemas del diseño actual (por qué se rehace)

Del `schema.sql` y de `src/lib/dailyEntryApi.tsx`:

1. **Tasks y gratitudes se borran y recrean en cada guardado** (`saveFullEntry` hace `DELETE`
   + `INSERT`). Se pierde el `created_at` real, la identidad de cada ítem cambia, y el estado
   "completada" solo refleja el último guardado → **el historial de qué se completó y cuándo
   es poco confiable**.
2. **El ánimo es un único valor por día, sobrescribible** (`upsert` por `user_id,date`). No
   hay trayectoria intra-día ni registro de cambios.
3. **RLS inseguro (bug de privacidad):** las policies chequean `auth.role() = 'authenticated'`
   pero **no** `user_id = auth.uid()`. Cualquier usuaria autenticada podía leer/editar/borrar
   filas de otras. Con datos en texto plano y de salud mental, es un agujero grave. La policy
   de DELETE de `contacts` además está mal escrita como `SELECT`.
4. **`contact` duplicado:** existe `entries.contact` (texto) *y* una tabla `contacts`. Dos
   fuentes de verdad.
5. **`contacts` es en realidad UN contacto** (`UNIQUE(user_id)`), mal nombrado en plural.

### Principio del rediseño

Reemplazar "borrar y recrear" por **eventos append-only y timestamped** e **ítems de primera
clase con ciclo de vida** (una tarea nace y se completa con su `completedAt`, nunca se
destruye). Esto **arregla los bugs** y **habilita las vistas de historial** deseadas. El
aislamiento por usuaria se vuelve inherente al modelo (ver §4 y §6).

---

## 3. Arquitectura general

Una sola topología que corre igual local (Ministack) y en AWS. Solo cambia el endpoint
(`http://localhost:4566` vs. endpoints reales de AWS). **El mismo código es la demo y el
diseño.**

```
[Usuaria / PWA]
   │ HTTPS / TLS
   ▼
Next.js PWA (gentle-task-companion)
   │  · Amplify Auth (Cognito) para login
   │  · cliente de datos → API Gateway con JWT
   ▼
Cognito User Pool ──(JWT)──► API Gateway HTTP (JWT authorizer)
                                   │
                        ┌──────────┴───────────┐
                        ▼                      ▼
                 Lambda core-api         Lambda companion
             (ánimo/tareas/gratitud)   (animalitos: select/upload)
                        │                      │
                        ▼                      ▼
                   DynamoDB               S3 (imágenes)
                 (single-table)          curadas + subidas
                        │                      │
                        └──── KMS (cifrado at-rest) ────┘

Observabilidad: CloudWatch logs/métricas (local: logs de Ministack)
```

### Componentes

| Componente | Local (Ministack) | AWS (diseño) |
|---|---|---|
| Frontend | Next.js en contenedor | S3 + CloudFront (o Amplify Hosting) |
| Auth | Cognito emulado (Ministack) | Amazon Cognito User Pool |
| API | API Gateway HTTP emulado | API Gateway HTTP + JWT authorizer |
| Compute | 2 Lambdas (Node/TS) | AWS Lambda |
| Datos | DynamoDB emulado | Amazon DynamoDB (on-demand) |
| Media | S3 emulado | Amazon S3 (privado) |
| Cripto | KMS emulado | AWS KMS (CMK) |

**Enfoque elegido: A — slice vertical lean.** Dos Lambdas (no microservicios por dominio, no
mínimo con restos de Supabase). Saca Supabase del todo, muestra todos los servicios objetivo
y mapea 1:1 a AWS, con riesgo acotado.

**Emulador local: Ministack** (MIT, gratis, argentino — Nahuel Nucera), drop-in de LocalStack
en el puerto `:4566`. Soporta Cognito, DynamoDB, Lambda, S3, API Gateway, KMS y SNS sin
licencia. Se eligió sobre LocalStack porque LocalStack movió servicios core (y Cognito) a su
edición Pro paga.

### Portabilidad (anti-lock-in) — objetivo primario

La app se escribe contra **interfaces portables**, no contra APIs propietarias, para correr el
**mismo código** en AWS y en un stack self-hosted gratuito (homelab: Proxmox/VM + Cloudflare
Tunnel, o cluster k8s Talos). El destino se elige por configuración (endpoints / issuer OIDC).

| Rol | AWS (diseño/TP) | Self-hosted gratis (homelab) | Interfaz portable |
|---|---|---|---|
| Objetos/imágenes | S3 | MinIO | API S3 |
| Datos | DynamoDB | ScyllaDB Alternator (prod) / DynamoDB Local (dev) | API DynamoDB |
| Auth | Cognito | Authentik (o Authelia/Zitadel) | OIDC (JWT estándar) |
| Compute | Lambda | contenedor (VM) / Deployment (k8s) | handler puro + adaptador |
| Ingress | API Gateway | Caddy/Traefik + Cloudflare Tunnel | HTTP |
| Cifrado at-rest | KMS | SSE de MinIO/Scylla + LUKS | — |

- **Datos:** ScyllaDB Alternator expone la API de DynamoDB → el mismo SDK y el mismo modelo
  single-table corren en AWS y en casa. Dev local liviano con DynamoDB Local.
- **Auth:** único punto sin drop-in de producción. Se abstrae por **OIDC**: la app valida JWT
  OIDC estándar; el emisor es Cognito (AWS) o un IdP OSS liviano (self-host). En el front se usa
  un cliente OIDC genérico en vez del SDK Amplify. **Authentik** es el preferido (IdP OIDC
  completo, más liviano que Keycloak; la autora ya lo corre en su cluster Talos); Authelia/Zitadel
  como alternativas.
- **Compute:** la lógica vive en funciones puras (`event → result`); un adaptador fino la corre
  como Lambda (AWS) o como servidor HTTP en contenedor (VM/k8s).

---

## 4. Modelo de datos (DynamoDB single-table)

Tabla `gentle`, `PK = USER#<sub>` (el `sub` de Cognito). Todo lo de una persona vive en su
partición; la **sort key es el tipo de cosa** y los atributos son el estado. El "join"
relacional se reemplaza por una sola `Query` a la partición.

| Ítem | SK | Atributos | Habilita |
|---|---|---|---|
| Perfil | `PROFILE` | preferredSpecies, locale, emergencyContact{name,phone} | preferencias + contacto de emergencia embebido |
| Check-in de ánimo | `MOOD#<ISO-ts>` | mood, note? | trayectoria de ánimo + intra-día |
| Tarea | `TASK#<ulid>` | text, status, createdAt, completedAt | registro de tareas completadas |
| Gratitud | `GRAT#<ISO-ts>` | text | diario de gratitud |
| Animalito (favorito) | `ANIMAL#<ulid>` | species, apiSource, s3Key, savedAt | galería de favoritos guardados |
| Stats (opcional) | `STATS` | streakDays, tasksDone, lastActive | rachas / estadísticas |

### Decisiones

- **Contacto de emergencia embebido en `PROFILE`** (era 1 por usuaria) → elimina la tabla
  `contacts` y `entries.contact` (resuelve la duplicación y el naming).
- **Desaparece "entry" como contenedor del día:** el ánimo es un log timestamped; tareas y
  gratitudes son ítems de primera clase. **Se elimina el patrón delete+reinsert.**
- **GSI1 opcional** para "tareas completadas por fecha": `GSI1PK = USER#<sub>`,
  `GSI1SK = DONE#<completedAt>` (solo se setea al completar) → timeline ordenado. YAGNI para
  el MVP (se calcula en la Lambda a partir de los ítems `TASK#`); queda anotado para escala.
- **Cifrado at-rest** de la tabla con KMS (CMK).

### Patrones de acceso (todas single-partition, sin joins)

- Dashboard de hoy → `Query PK=USER#<sub>` (arma todo en un request).
- Trayectoria de ánimo → `SK begins_with "MOOD#"` (ordenado por timestamp); mes actual →
  `begins_with "MOOD#2026-08-"`.
- Tareas → `SK begins_with "TASK#"`; completadas → filtrar por `completedAt` (o GSI1).
- Diario de gratitud → `SK begins_with "GRAT#"`, orden inverso.
- Rachas/estadísticas → se calculan en la Lambda desde los ítems, o vía ítem `STATS`.

---

## 5. API + Lambdas + flujo de autenticación

### Auth

1. Registro/login vía **OIDC** (cliente OIDC genérico en el front) → el emisor emite JWT.
   Emisor = Cognito en AWS, Authentik/Authelia en self-host (se cambia por config).
2. El front envía `Authorization: Bearer <token>` al ingress (API Gateway o reverse proxy).
3. Un **validador JWT/OIDC** (JWT authorizer de API Gateway en AWS; middleware en el handler en
   self-host) valida firma/emisor/audiencia contra el issuer y extrae los claims.
4. La Lambda lee `event.requestContext.authorizer.jwt.claims.sub` y lo usa como `PK`.
   **Nunca confía en un `user_id` del body** → cierra el bug de aislamiento del diseño viejo.

### Endpoints

**core-api Lambda**

- `GET /dashboard` — today view (una Query a la partición arma todo)
- `POST /moods` · `GET /moods?from=&to=` — check-in de ánimo + trayectoria
- `POST /tasks` · `PATCH /tasks/{id}` (completar) · `GET /tasks?status=`
- `POST /gratitudes` · `GET /gratitudes` — diario
- `GET /me` · `PUT /me` — perfil / preferencias

**companion Lambda**

- `GET /companion?species=` — trae una imagen **random** del animal (API externa) → URL
- `POST /companion/save` — guarda la imagen actual como favorita en S3 (registra `ANIMAL#`)
- `GET /companion/saved` — lista los favoritos del usuario → URLs prefirmadas

### IAM mínimo privilegio

- `core-api` → solo DynamoDB (Query/PutItem/UpdateItem sobre `gentle`) + KMS decrypt.
- `companion` → S3 (Get/Put sobre `gentle-animals`, favoritos) + `ANIMAL#` en DynamoDB + KMS +
  salida HTTPS a las APIs de animales + lectura de la API key (Secrets Manager / SOPS).
- Sin permisos cruzados entre Lambdas.

---

## 6. Feature de animalitos (APIs externas + S3 para favoritos)

Companion multi-especie: la persona elige su animal preferido (gato, capivara, perro, pájaro)
en el perfil y, cuando busca calma, recibe una imagen **random** de esa especie. El valor es el
consuelo del animalito en sí — **no** se pretende que la imagen "refleje" el ánimo (los animales
no expresan emoción de forma fiable, y forzar upload/curado sería fricción de UX). El ánimo se
registra aparte (`moods`). *(El matching por ánimo con set curado en S3 = iteración B, futura.)*

Fuentes por especie (con fallback en cadena si una falla):
gato → **TheCatAPI** · perro → **TheDogAPI** · capivara → **capy.lol** · pájaro → **Nuthatch**
(requiere API key) o **Ornithophile** (imágenes de Wikimedia, parsear).

Bucket `gentle-animals` privado, **SSE-KMS** → **solo para favoritos guardados y caché**
(no hay set curado ni uploads del usuario).

### Flujos

- **Fetch random:** `GET /companion?species=capybara` → la Lambda pega a la API de esa especie
  → devuelve la URL de una imagen random (o la proxya). Sin estado.
- **Guardar favorito:** `POST /companion/save` con `{species, imageUrl}` → la Lambda baja la
  imagen y la guarda en `users/<sub>/<ulid>` (S3, SSE-KMS) y registra `ANIMAL#` en DynamoDB.
  Sirve de galería personal y de caché (reduce llamadas a APIs con rate-limit como Nuthatch).
- **Ver galería:** `GET /companion/saved` → lista `ANIMAL#` del usuario → URLs prefirmadas.

### Notas

- **Secretos:** la API key de Nuthatch va en Secrets Manager (AWS) / SOPS (self-host), nunca
  hardcodeada.
- **Dependencia de internet:** el fetch primario usa APIs externas → el demo necesita internet;
  los favoritos en S3 mitigan (caché / offline parcial).
- **Cifrado:** favoritos SSE-KMS at-rest; URLs prefirmadas sobre HTTPS in-transit.

---

## 7. Seguridad y cifrado (pilar Seguridad)

- **Autenticación:** Cognito User Pool (registro/verificación por email, MFA opcional, JWT).
- **Autorización:** JWT authorizer en API Gateway; sin endpoints públicos.
- **Aislamiento por usuaria:** `PK = USER#<sub-del-JWT>`; la Lambda nunca consulta otra
  partición. Reforzable con condición IAM `dynamodb:LeadingKeys`. Corrige el RLS roto.
- **Cifrado at-rest:** KMS (CMK) sobre DynamoDB y S3.
- **Cifrado in-transit:** TLS/HTTPS en CloudFront, API Gateway y URLs prefirmadas.
- **En self-host:** cifrado at-rest con SSE de MinIO/ScyllaDB + LUKS en la VM; TLS vía Cloudflare
  Tunnel; secretos con SOPS/age (como ya usa el homelab).
- **Mínimo privilegio:** roles IAM por Lambda acotados a sus recursos.
- **Secretos:** sin claves en el código. La API key de Nuthatch (imágenes de pájaros) y demás
  secretos van en **Secrets Manager** (AWS) / **SOPS+age** (self-host).

---

## 8. Costos (estimación en AWS real)

Modelo 100% serverless y on-demand → **escala a cero**: sin tráfico, casi sin costo.
Uso esperado bajo (app personal / demo).

| Servicio | Modelo de precio | Free tier | Costo a uso bajo |
|---|---|---|---|
| Cognito | por MAU | 50.000 MAU gratis | ~$0 |
| Lambda | por invocación + GB-s | 1M req + 400k GB-s/mes | ~$0 |
| API Gateway HTTP | por request | 1M req/mes (12 meses) | ~$0–1 |
| DynamoDB on-demand | lectura/escritura + almacenamiento | 25 GB + límites gratis | ~$0–1 |
| S3 | almacenamiento + requests | 5 GB (12 meses) | centavos |
| KMS | $1/CMK/mes + requests | 20k req/mes | ~$1/mes |
| CloudFront | transferencia + requests | 1 TB/mes (siempre) | ~$0 |
| CloudWatch | logs/métricas | límites gratis | ~$0 |

- **Servicio más costoso a baja escala:** KMS (~$1/mes por la CMK); luego CloudFront/DynamoDB
  si crece tráfico/almacenamiento.
- **Estimado a uso bajo:** < $2–3 USD/mes. A uso cero: ~$1/mes (solo la CMK).
- **Optimización:** on-demand en vez de capacidad provisionada; escala a cero; URLs
  prefirmadas (sin servidor de media); imágenes optimizadas en S3; una sola CMK compartida.
- **Qué evitar en v1:** NAT Gateway, RDS, instancias 24/7, Managed Grafana (se usa CloudWatch).
- **Local = $0:** Ministack es gratis (MIT); desarrollar/testear no cuesta.

---

## 9. Despliegue — dos builds del mismo código

**Build 1 — self-hosted (la app real de la autora).** `docker compose up` levanta MinIO (S3) +
ScyllaDB Alternator (DynamoDB) + Authentik (OIDC) + los contenedores del front y de los handlers.
Corre en una VM del homelab (Proxmox) expuesta con **Cloudflare Tunnel** + DNS; a futuro,
microservicios en el cluster **Talos**. Cifrado at-rest con SSE de MinIO/Scylla + LUKS. Costo: $0.

**Build 2 — Ministack (AWS emulado, para el TP).** `docker compose up` levanta **Ministack**
(`:4566`) + el front. Un script de bootstrap crea los recursos vía AWS CLI/SDK con
`--endpoint-url http://localhost:4566`: User Pool de Cognito, tabla `gentle`, bucket
`gentle-animals`, CMK de KMS, las 2 Lambdas y las rutas de API Gateway; y siembra las imágenes.

En ambos, el destino se elige por config (endpoints / issuer OIDC): **el código no cambia**.
Cualquiera de los dos `docker compose` funcionando (con screenshot) cubre el criterio "app
dockerizada" del TP con arquitectura real, no un mock.

---

## 10. Alcance del TP y mapeo a la rúbrica

| Doc de la rúbrica | Fuente en este diseño |
|---|---|
| `01-descripcion.md` | §1 (app, usuarias, por qué NoSQL/DynamoDB) |
| `02-arquitectura-local.md` | §9 (Ministack + docker-compose) |
| `03-arquitectura-aws.md` | §3 + §5 + §6 (servicios y justificación) |
| `04-well-architected.md` | §7 (Seguridad) + pilares (a completar) |
| `05-costos.md` | §8 (estimación de costos) |
| `06-disaster-recovery.md` | §11 (semilla de riesgos/DR) |
| `diagrams/arquitectura-aws.png` | §3 (diagrama, a pasar a draw.io) |
| `app/` | la app dockerizada (§8) |

**Construimos:** backend portable nuevo (handlers puros + capa de datos API-DynamoDB + API-S3 +
OIDC), front rewireado, y el feature de animalitos — corriendo en los dos builds (self-hosted y
Ministack).
**Diseñamos (docs):** el mapeo a AWS real, la narrativa de evolución (Supabase → self-hosted →
AWS), pilares Well-Architected, costos y DR.

---

## 11. Semilla de Disaster Recovery / riesgos (para `06`)

- **Datos sensibles de salud mental** → privacidad/compliance; cifrado at-rest + in-transit;
  mínimo acceso; el usuario puede borrar sus datos.
- **RPO/RTO:** DynamoDB PITR (point-in-time recovery) + backups; S3 versioning. RPO bajo
  (minutos con PITR), RTO acotado (restore de tabla/bucket).
- **Escenarios:** caída de AZ (servicios gestionados multi-AZ), corrupción/borrado accidental
  (PITR + versioning), error humano (backups), fallo regional (estrategia Backup & Restore /
  Pilot Light a definir).
- **Bug histórico corregido:** aislamiento por usuaria (antes RLS roto).

---

## 12. Fuera de alcance / futuro

- Rediseño visual/UX de la app (se conversará después).
- Fallback a API externa de imágenes (stretch).
- Moderación de contenido de imágenes subidas.
- Migración de datos: no aplica (la app no tiene datos en producción).
