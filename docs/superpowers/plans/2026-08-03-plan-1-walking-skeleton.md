# Plan 1 — Walking Skeleton Portable (self-hosted) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una rebanada vertical end-to-end — un usuario autenticado registra un check-in de ánimo (`POST /moods`) y ve su historial (`GET /moods`) — corriendo sobre el build **self-hosted** (DynamoDB Local + OIDC dev), con el código escrito contra interfaces portables (API DynamoDB + OIDC) y con tests.

**Architecture:** Backend portable separado del front Next.js, en `backend/`. Handlers puros con **Hono** (corren en Node hoy y en Lambda en el Plan 4 sin cambios). Capa de datos con AWS SDK v3 DocumentClient apuntando a un endpoint configurable (`DYNAMODB_ENDPOINT` → DynamoDB Local | ScyllaDB Alternator | AWS). Auth por **OIDC**: middleware que valida JWT contra un issuer configurable (Authentik/Cognito/dev-OIDC). Todo se levanta con `docker-compose.selfhosted.yml`.

**Tech Stack:** TypeScript (ESM, Node 20), Hono + `@hono/node-server`, `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb`, `jose` (JWT/OIDC), Vitest, `tsx`. DynamoDB Local y `mock-oauth2-server` como contenedores de dev.

**Alcance de este plan:** solo el backend vertical (datos + auth + handlers de ánimo), demostrable vía HTTP autenticado (curl). El cableado de la UI React y el resto del dominio (tasks/gratitudes/dashboard) van en el Plan 2.

**Modelo de datos (del spec §4):** tabla `gentle`, `PK = USER#<sub>`. Ítem de ánimo: `SK = MOOD#<ISO-ts>`, atributos `{ type: "mood", mood, note?, createdAt }`.

---

## File Structure

```
backend/
  package.json            # deps + scripts del backend portable
  tsconfig.json
  vitest.config.ts
  src/
    data/
      client.ts           # factory del DocumentClient (endpoint configurable)
      table.ts            # nombre de tabla + helpers de claves (PK/SK)
      moods.ts            # repositorio de ánimo (createMood, listMoods)
    auth/
      oidc.ts             # middleware Hono de verificación JWT/OIDC
    app.ts                # app Hono (rutas) — handlers puros, con DI
    server.ts             # adaptador Node (sirve la app en un puerto)
  test/
    setup.ts              # vitest globalSetup: crea la tabla en DynamoDB Local
    moods.test.ts
    auth.test.ts
    app.test.ts
  scripts/
    create-table.ts       # bootstrap de la tabla (portable, endpoint configurable)
  Dockerfile
docker-compose.selfhosted.yml
.env.selfhosted.example
```

---

## Task 0: Scaffold del backend portable

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vitest.config.ts`

- [ ] **Step 1: Crear `backend/package.json`**

```json
{
  "name": "gentle-backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "tsx src/server.ts",
    "create-table": "tsx scripts/create-table.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.658.0",
    "@aws-sdk/lib-dynamodb": "^3.658.0",
    "@hono/node-server": "^1.13.0",
    "hono": "^4.6.0",
    "jose": "^5.9.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Crear `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "include": ["src", "scripts", "test"]
}
```

- [ ] **Step 3: Crear `backend/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/setup.ts"],
    env: {
      DYNAMODB_ENDPOINT: "http://localhost:8000",
      AWS_REGION: "us-east-1",
      AWS_ACCESS_KEY_ID: "local",
      AWS_SECRET_ACCESS_KEY: "local",
      TABLE_NAME: "gentle",
    },
    hookTimeout: 30000,
  },
});
```

- [ ] **Step 4: Instalar dependencias**

Run: `cd backend && npm install`
Expected: crea `node_modules` y `package-lock.json` sin errores.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/vitest.config.ts backend/package-lock.json
git commit -m "chore(backend): scaffold portable backend (hono + aws-sdk + vitest)"
```

---

## Task 1: Capa de datos — client + helpers de claves

**Files:**
- Create: `backend/src/data/client.ts`
- Create: `backend/src/data/table.ts`
- Test: `backend/test/table.test.ts` (unitario, sin DB)

- [ ] **Step 1: Escribir el test de los helpers de claves**

`backend/test/table.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { userPk, moodSk } from "../src/data/table";

describe("table key helpers", () => {
  it("builds the user partition key", () => {
    expect(userPk("abc-123")).toBe("USER#abc-123");
  });

  it("builds a mood sort key from an ISO timestamp", () => {
    expect(moodSk("2026-08-03T14:22:00.000Z")).toBe("MOOD#2026-08-03T14:22:00.000Z");
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && npx vitest run test/table.test.ts`
Expected: FAIL — `Cannot find module '../src/data/table'`.

- [ ] **Step 3: Implementar `client.ts` y `table.ts`**

`backend/src/data/client.ts`:
```ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * Crea un DocumentClient apuntando al endpoint configurado.
 * Portable: DYNAMODB_ENDPOINT = DynamoDB Local | ScyllaDB Alternator | (vacío) AWS real.
 */
export function makeDocClient(): DynamoDBDocumentClient {
  const endpoint = process.env.DYNAMODB_ENDPOINT || undefined;
  const base = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    ...(endpoint ? { endpoint } : {}),
  });
  return DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export const TABLE_NAME = process.env.TABLE_NAME || "gentle";
```

`backend/src/data/table.ts`:
```ts
export function userPk(sub: string): string {
  return `USER#${sub}`;
}

export function moodSk(isoTimestamp: string): string {
  return `MOOD#${isoTimestamp}`;
}

/** Prefijo para consultar todos los ánimos de un usuario. */
export const MOOD_PREFIX = "MOOD#";
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd backend && npx vitest run test/table.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/data/client.ts backend/src/data/table.ts backend/test/table.test.ts
git commit -m "feat(backend): dynamodb doc client + single-table key helpers"
```

---

## Task 2: Bootstrap de la tabla + repositorio de ánimo (integración con DynamoDB Local)

**Files:**
- Create: `backend/scripts/create-table.ts`
- Create: `backend/test/setup.ts`
- Create: `backend/src/data/moods.ts`
- Test: `backend/test/moods.test.ts`

- [ ] **Step 1: Levantar DynamoDB Local (prerequisito de los tests de integración)**

Run: `docker run -d --name gentle-ddb-local -p 8000:8000 amazon/dynamodb-local:latest`
Expected: contenedor corriendo; `curl http://localhost:8000` responde (HTTP 400/error de DynamoDB, lo que confirma que escucha).

- [ ] **Step 2: Escribir el script de creación de tabla**

`backend/scripts/create-table.ts`:
```ts
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  ResourceInUseException,
} from "@aws-sdk/client-dynamodb";
import { TABLE_NAME } from "../src/data/client";

export async function createTable(): Promise<void> {
  const endpoint = process.env.DYNAMODB_ENDPOINT || undefined;
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    ...(endpoint ? { endpoint } : {}),
  });

  try {
    await client.send(
      new CreateTableCommand({
        TableName: TABLE_NAME,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [
          { AttributeName: "PK", AttributeType: "S" },
          { AttributeName: "SK", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "PK", KeyType: "HASH" },
          { AttributeName: "SK", KeyType: "RANGE" },
        ],
      }),
    );
  } catch (err) {
    if (!(err instanceof ResourceInUseException)) throw err;
  }
  await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
}

// Permite correrlo como script directo: `npm run create-table`
if (import.meta.url === `file://${process.argv[1]}`) {
  createTable().then(() => console.log(`Tabla ${TABLE_NAME} lista`));
}
```

- [ ] **Step 3: Escribir el globalSetup de vitest**

`backend/test/setup.ts`:
```ts
import { createTable } from "../scripts/create-table";

export default async function setup(): Promise<void> {
  await createTable();
}
```

- [ ] **Step 4: Escribir el test del repositorio de ánimo**

`backend/test/moods.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createMood, listMoods } from "../src/data/moods";

function uniqueSub() {
  return `test-${Math.floor(performance.now() * 1000)}`;
}

describe("moods repository", () => {
  it("creates a mood and lists it back", async () => {
    const sub = uniqueSub();
    const { createdAt } = await createMood(sub, { mood: "tranquila" });
    expect(createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const moods = await listMoods(sub);
    expect(moods).toHaveLength(1);
    expect(moods[0].mood).toBe("tranquila");
    expect(moods[0].createdAt).toBe(createdAt);
  });

  it("returns moods most-recent first", async () => {
    const sub = uniqueSub();
    await createMood(sub, { mood: "ansiosa", createdAt: "2026-08-03T10:00:00.000Z" });
    await createMood(sub, { mood: "tranquila", createdAt: "2026-08-03T20:00:00.000Z" });

    const moods = await listMoods(sub);
    expect(moods.map((m) => m.mood)).toEqual(["tranquila", "ansiosa"]);
  });

  it("isolates moods by user", async () => {
    const a = uniqueSub();
    const b = uniqueSub();
    await createMood(a, { mood: "feliz" });
    expect(await listMoods(b)).toHaveLength(0);
  });
});
```

- [ ] **Step 5: Correr el test para verificar que falla**

Run: `cd backend && npx vitest run test/moods.test.ts`
Expected: FAIL — `Cannot find module '../src/data/moods'`.

- [ ] **Step 6: Implementar el repositorio de ánimo**

`backend/src/data/moods.ts`:
```ts
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { makeDocClient, TABLE_NAME } from "./client";
import { userPk, moodSk, MOOD_PREFIX } from "./table";

const doc = makeDocClient();

export interface Mood {
  mood: string;
  note?: string;
  createdAt: string;
}

export interface CreateMoodInput {
  mood: string;
  note?: string;
  /** Opcional: permite fijar el timestamp en tests. Por defecto, ahora. */
  createdAt?: string;
}

export async function createMood(sub: string, input: CreateMoodInput): Promise<Mood> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const item = {
    PK: userPk(sub),
    SK: moodSk(createdAt),
    type: "mood",
    mood: input.mood,
    note: input.note,
    createdAt,
  };
  await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return { mood: input.mood, note: input.note, createdAt };
}

export async function listMoods(
  sub: string,
  range?: { from?: string; to?: string },
): Promise<Mood[]> {
  const from = range?.from ? moodSk(range.from) : MOOD_PREFIX;
  const to = range?.to ? moodSk(range.to) + "￿" : MOOD_PREFIX + "￿";
  const res = await doc.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND SK BETWEEN :from AND :to",
      ExpressionAttributeValues: { ":pk": userPk(sub), ":from": from, ":to": to },
      ScanIndexForward: false, // más reciente primero
    }),
  );
  return (res.Items ?? []).map((i) => ({
    mood: i.mood as string,
    note: i.note as string | undefined,
    createdAt: i.createdAt as string,
  }));
}
```

- [ ] **Step 7: Correr el test para verificar que pasa**

Run: `cd backend && npx vitest run test/moods.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add backend/scripts/create-table.ts backend/test/setup.ts backend/src/data/moods.ts backend/test/moods.test.ts
git commit -m "feat(backend): mood repository over dynamodb single-table + table bootstrap"
```

---

## Task 3: Middleware de auth OIDC (verificación JWT)

**Files:**
- Create: `backend/src/auth/oidc.ts`
- Test: `backend/test/auth.test.ts`

- [ ] **Step 1: Escribir el test del middleware con JWKS local**

`backend/test/auth.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { Hono } from "hono";
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet, type JWK } from "jose";
import { createAuth } from "../src/auth/oidc";

const ISSUER = "https://issuer.test";
const AUDIENCE = "gentle";
let sign: (sub: string) => Promise<string>;
let app: Hono;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = (await exportJWK(publicKey)) as JWK;
  jwk.kid = "test-key";
  const jwks = createLocalJWKSet({ keys: [jwk] });

  sign = (sub: string) =>
    new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setSubject(sub)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime("1h")
      .sign(privateKey);

  app = new Hono();
  app.use("*", createAuth({ jwks, issuer: ISSUER, audience: AUDIENCE }));
  app.get("/whoami", (c) => c.json({ sub: c.get("sub") }));
});

describe("OIDC auth middleware", () => {
  it("rejects requests without a token", async () => {
    const res = await app.request("/whoami");
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token", async () => {
    const res = await app.request("/whoami", {
      headers: { Authorization: "Bearer not-a-jwt" },
    });
    expect(res.status).toBe(401);
  });

  it("accepts a valid token and exposes the sub", async () => {
    const token = await sign("user-42");
    const res = await app.request("/whoami", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sub: "user-42" });
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && npx vitest run test/auth.test.ts`
Expected: FAIL — `Cannot find module '../src/auth/oidc'`.

- [ ] **Step 3: Implementar el middleware**

`backend/src/auth/oidc.ts`:
```ts
import type { MiddlewareHandler } from "hono";
import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from "jose";

export interface AuthConfig {
  jwks: JWTVerifyGetKey;
  issuer: string;
  audience: string;
}

/**
 * Middleware Hono que valida un JWT OIDC estándar.
 * Portable: el issuer/JWKS se inyecta (Cognito, Authentik, Zitadel, dev-OIDC).
 * Deja el `sub` del token en el contexto.
 */
export function createAuth(config: AuthConfig): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header("Authorization") || "";
    const match = header.match(/^Bearer (.+)$/);
    if (!match) return c.json({ error: "missing bearer token" }, 401);

    try {
      const { payload } = await jwtVerify(match[1], config.jwks, {
        issuer: config.issuer,
        audience: config.audience,
      });
      if (!payload.sub) return c.json({ error: "token has no sub" }, 401);
      c.set("sub", payload.sub);
      await next();
    } catch {
      return c.json({ error: "invalid token" }, 401);
    }
  };
}

/** Fábrica para producción: resuelve el JWKS remoto del issuer OIDC. */
export function authFromEnv(): AuthConfig {
  const issuer = requireEnv("OIDC_ISSUER");
  const jwksUri = requireEnv("OIDC_JWKS_URI");
  const audience = requireEnv("OIDC_AUDIENCE");
  return { jwks: createRemoteJWKSet(new URL(jwksUri)), issuer, audience };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}
```

- [ ] **Step 4: Declarar el tipo de la variable de contexto `sub`**

Create `backend/src/types.d.ts`:
```ts
import "hono";

declare module "hono" {
  interface ContextVariableMap {
    sub: string;
  }
}
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `cd backend && npx vitest run test/auth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/auth/oidc.ts backend/src/types.d.ts backend/test/auth.test.ts
git commit -m "feat(backend): portable OIDC jwt auth middleware"
```

---

## Task 4: App Hono — rutas de ánimo

**Files:**
- Create: `backend/src/app.ts`
- Test: `backend/test/app.test.ts`

- [ ] **Step 1: Escribir el test de integración de las rutas**

`backend/test/app.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet, type JWK } from "jose";
import { createApp } from "../src/app";
import { createMood, listMoods } from "../src/data/moods";

const ISSUER = "https://issuer.test";
const AUDIENCE = "gentle";
let sign: (sub: string) => Promise<string>;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = (await exportJWK(publicKey)) as JWK;
  jwk.kid = "k";
  const jwks = createLocalJWKSet({ keys: [jwk] });
  sign = (sub) =>
    new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "k" })
      .setSubject(sub)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime("1h")
      .sign(privateKey);
  app = createApp({
    auth: { jwks, issuer: ISSUER, audience: AUDIENCE },
    moods: { createMood, listMoods },
  });
});

describe("moods API", () => {
  it("requires auth", async () => {
    const res = await app.request("/moods", { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
  });

  it("creates and lists a mood for the authed user", async () => {
    const sub = `api-${Math.floor(performance.now() * 1000)}`;
    const token = await sign(sub);

    const post = await app.request("/moods", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mood: "esperanzada" }),
    });
    expect(post.status).toBe(201);

    const get = await app.request("/moods", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(get.status).toBe(200);
    const body = await get.json();
    expect(body.moods).toHaveLength(1);
    expect(body.moods[0].mood).toBe("esperanzada");
  });

  it("rejects an empty mood", async () => {
    const token = await sign("api-validation");
    const res = await app.request("/moods", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mood: "" }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && npx vitest run test/app.test.ts`
Expected: FAIL — `Cannot find module '../src/app'`.

- [ ] **Step 3: Implementar la app Hono con DI**

`backend/src/app.ts`:
```ts
import { Hono } from "hono";
import { createAuth, type AuthConfig } from "./auth/oidc";
import type { Mood, CreateMoodInput } from "./data/moods";

export interface MoodsRepo {
  createMood(sub: string, input: CreateMoodInput): Promise<Mood>;
  listMoods(sub: string, range?: { from?: string; to?: string }): Promise<Mood[]>;
}

export interface AppDeps {
  auth: AuthConfig;
  moods: MoodsRepo;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  app.use("*", createAuth(deps.auth));

  app.post("/moods", async (c) => {
    const sub = c.get("sub");
    const body = await c.req.json().catch(() => ({}));
    const mood = typeof body.mood === "string" ? body.mood.trim() : "";
    if (!mood) return c.json({ error: "mood is required" }, 400);
    const created = await deps.moods.createMood(sub, { mood, note: body.note });
    return c.json(created, 201);
  });

  app.get("/moods", async (c) => {
    const sub = c.get("sub");
    const from = c.req.query("from");
    const to = c.req.query("to");
    const moods = await deps.moods.listMoods(sub, { from, to });
    return c.json({ moods });
  });

  return app;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd backend && npx vitest run test/app.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Correr toda la suite**

Run: `cd backend && npm test`
Expected: PASS — table (2) + moods (3) + auth (3) + moods API (3) = 11 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/src/app.ts backend/test/app.test.ts
git commit -m "feat(backend): hono app with mood create/list routes"
```

---

## Task 5: Adaptador Node + Dockerfile

**Files:**
- Create: `backend/src/server.ts`
- Create: `backend/Dockerfile`

- [ ] **Step 1: Escribir el adaptador Node**

`backend/src/server.ts`:
```ts
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { authFromEnv } from "./auth/oidc";
import { createMood, listMoods } from "./data/moods";

const app = createApp({
  auth: authFromEnv(),
  moods: { createMood, listMoods },
});

const port = Number(process.env.PORT || 8080);
serve({ fetch: app.fetch, port });
console.log(`gentle-backend escuchando en :${port}`);
```

- [ ] **Step 2: Verificar que el server arranca (falla temprano por env faltante)**

Run: `cd backend && npx tsx src/server.ts`
Expected: lanza `Error: Falta la variable de entorno OIDC_ISSUER` (confirma que el wiring de auth por env funciona). Cortar con Ctrl-C.

- [ ] **Step 3: Escribir el `Dockerfile`**

`backend/Dockerfile`:
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
ENV PORT=8080
EXPOSE 8080
CMD ["npx", "tsx", "src/server.ts"]
```

- [ ] **Step 4: Build de la imagen para verificar que es válida**

Run: `cd backend && docker build -t gentle-backend:dev .`
Expected: build OK, imagen `gentle-backend:dev` creada.

- [ ] **Step 5: Commit**

```bash
git add backend/src/server.ts backend/Dockerfile
git commit -m "feat(backend): node server adapter + dockerfile"
```

---

## Task 6: docker-compose self-hosted + smoke test end-to-end

**Files:**
- Create: `docker-compose.selfhosted.yml` (raíz del repo)
- Create: `.env.selfhosted.example` (raíz del repo)

- [ ] **Step 1: Escribir `.env.selfhosted.example`**

`.env.selfhosted.example`:
```bash
# Datos (API DynamoDB) — DynamoDB Local en self-host
DYNAMODB_ENDPOINT=http://dynamodb-local:8000
TABLE_NAME=gentle
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local

# Auth OIDC — dev issuer (swap a Authentik cambiando estas 3)
OIDC_ISSUER=http://mock-oidc:8080/default
OIDC_JWKS_URI=http://mock-oidc:8080/default/jwks
OIDC_AUDIENCE=gentle

PORT=8080
```

- [ ] **Step 2: Escribir `docker-compose.selfhosted.yml`**

`docker-compose.selfhosted.yml`:
```yaml
services:
  dynamodb-local:
    image: amazon/dynamodb-local:latest
    command: ["-jar", "DynamoDBLocal.jar", "-inMemory"]
    ports:
      - "8000:8000"

  mock-oidc:
    image: ghcr.io/navikt/mock-oauth2-server:2.1.10
    environment:
      SERVER_PORT: "8080"
    ports:
      - "8081:8080"

  create-table:
    build: ./backend
    depends_on:
      - dynamodb-local
    environment:
      DYNAMODB_ENDPOINT: http://dynamodb-local:8000
      TABLE_NAME: gentle
      AWS_REGION: us-east-1
      AWS_ACCESS_KEY_ID: local
      AWS_SECRET_ACCESS_KEY: local
    command: ["npx", "tsx", "scripts/create-table.ts"]
    restart: "no"

  backend:
    build: ./backend
    depends_on:
      - dynamodb-local
      - mock-oidc
    env_file: .env.selfhosted.example
    ports:
      - "8080:8080"
```

Nota: el `Dockerfile` de la Task 5 copia solo `src`. Para que `create-table` encuentre `scripts/`, agregar `COPY scripts ./scripts` al Dockerfile antes de este paso.

- [ ] **Step 3: Agregar `scripts` al Dockerfile**

Modificar `backend/Dockerfile` — después de `COPY src ./src` agregar:
```dockerfile
COPY scripts ./scripts
```

- [ ] **Step 4: Levantar el stack**

Run: `docker compose -f docker-compose.selfhosted.yml up --build -d`
Expected: `dynamodb-local`, `mock-oidc` y `backend` corriendo; `create-table` corre una vez y termina (exit 0).

- [ ] **Step 5: Smoke test end-to-end (token del mock-oidc → POST → GET)**

Run:
```bash
# 1) Obtener un token del mock OIDC (audience=gentle, sub=demo-user)
TOKEN=$(curl -s -X POST "http://localhost:8081/default/token" \
  -d "grant_type=client_credentials" \
  -d "client_id=gentle" \
  -d "scope=openid" \
  -d "audience=gentle" | sed -E 's/.*"access_token":"([^"]+)".*/\1/')

# 2) Registrar un ánimo
curl -s -X POST http://localhost:8080/moods \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"mood":"tranquila"}'

# 3) Leer el historial
curl -s http://localhost:8080/moods -H "Authorization: Bearer $TOKEN"
```
Expected: el POST devuelve `{"mood":"tranquila","createdAt":"..."}` (201) y el GET devuelve `{"moods":[{"mood":"tranquila",...}]}`.

Nota de config: el `sub`/issuer/audience emitidos por `mock-oauth2-server` deben coincidir con `OIDC_ISSUER`/`OIDC_AUDIENCE` del `.env`. Si el token trae otro issuer, ajustar `OIDC_ISSUER` al valor del claim `iss` que emite el mock (visible decodificando el JWT en jwt.io).

- [ ] **Step 6: Bajar el stack**

Run: `docker compose -f docker-compose.selfhosted.yml down`

- [ ] **Step 7: Commit**

```bash
git add docker-compose.selfhosted.yml .env.selfhosted.example backend/Dockerfile
git commit -m "feat: self-hosted docker-compose (dynamodb-local + oidc + backend) with e2e smoke test"
```

---

## Self-Review

**Spec coverage (contra el spec §3–§9):**
- Interfaz de datos portable (API DynamoDB, endpoint configurable) → Task 1–2. ✔
- Modelo single-table `USER#<sub>` / `MOOD#<ts>` → Task 1–2. ✔
- Auth OIDC portable (issuer inyectable) → Task 3. ✔
- Handlers puros con Hono (portables a Lambda en Plan 4) → Task 4. ✔
- Aislamiento por usuaria (sub del token = PK; nunca del body) → Task 4 (usa `c.get("sub")`), test de aislamiento en Task 2. ✔
- Build self-hosted con docker-compose → Task 5–6. ✔
- Cifrado at-rest: **no** cubierto en Plan 1 (DynamoDB Local no cifra); se aborda en el build AWS (KMS, Plan 4) y en el despliegue homelab (LUKS/SSE, Plan 5). Anotado, no es un gap del skeleton.
- Feature animalitos, resto del dominio, UI React → fuera de alcance (Planes 2–3), declarado arriba.

**Placeholder scan:** sin TBD/TODO; cada step tiene código o comando concreto. ✔

**Type consistency:** `AuthConfig` (oidc.ts) se usa igual en app.ts y en los tests; `Mood`/`CreateMoodInput` (moods.ts) se reusan en `MoodsRepo` (app.ts); `createMood`/`listMoods` con la misma firma en repo, DI y tests. ✔

**Riesgo conocido:** el claim `iss`/`aud` exacto de `mock-oauth2-server` puede requerir ajustar `OIDC_ISSUER`/`OIDC_AUDIENCE` (Task 6, Step 5 lo aclara). No bloquea el diseño (los tests unitarios de auth usan JWKS local y no dependen del mock).
