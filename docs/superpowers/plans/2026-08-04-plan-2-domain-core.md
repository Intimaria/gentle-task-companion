# Plan 2 — Dominio core (backend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Completar la API del dominio sobre el mismo backend portable: **tareas** (con `completedAt`), **gratitudes** (diario), **perfil** (preferencias + contacto de emergencia) y **dashboard** (una sola Query a la partición que arma el "hoy" + stats). Reusa los patrones del Plan 1 (repos DynamoDB-API + rutas Hono + tests).

**Architecture:** Igual que Plan 1. Cada entidad = un módulo repo en `src/data/` con funciones tipadas y tests de integración contra DynamoDB Local. Las rutas se agregan a la app Hono con DI. El dashboard hace UNA Query `PK=USER#<sub>` y particiona por prefijo de SK (muestra el beneficio del single-table).

**Tech Stack:** idéntico al Plan 1 (TypeScript + Hono + AWS SDK v3 DynamoDB DocClient + jose + Vitest) + `ulid` (ids de tareas).

**Directorio de trabajo:** `Entregables/inti-maria-tidball/app/backend/` en el repo `arq-nube-2026` (rama `entrega/inti-maria-tidball`). NO commitear (la usuaria commitea en su estilo). Prerequisito de los tests de integración: DynamoDB Local en `:8000` (Task 5 lo automatiza).

**Modelo de datos (spec §4):**
- Tarea: `SK = TASK#<ulid>`, attrs `{ type:"task", id, text, status:"open"|"done", createdAt, completedAt? }`
- Gratitud: `SK = GRAT#<ISO-ts>`, attrs `{ type:"gratitude", text, createdAt }`
- Perfil: `SK = PROFILE`, attrs `{ preferredSpecies?, locale?, emergencyContact?:{name,phone} }`

---

## File Structure (nuevo/modificado en `app/backend/`)

```
src/data/tasks.ts         # createTask, listTasks, completeTask
src/data/gratitudes.ts    # createGratitude, listGratitudes
src/data/profile.ts       # getProfile, putProfile
src/data/streak.ts        # computeStreak (función pura, sin DB)
src/data/dashboard.ts     # getDashboard (1 Query a la partición + arma la vista)
src/app.ts                # (modificar) agregar rutas tasks/gratitudes/me/dashboard
test/tasks.test.ts
test/gratitudes.test.ts
test/profile.test.ts
test/streak.test.ts
test/dashboard.test.ts
test/app.test.ts          # (modificar) agregar casos de las rutas nuevas
package.json              # (modificar) + ulid pinned
scripts/ensure-ddb.sh     # arranca DynamoDB Local pinneado para los tests
```

---

## Task 1: Repositorio de tareas (+ dependencia ulid pinneada)

**Files:** Create `src/data/tasks.ts`, `test/tasks.test.ts`; Modify `package.json`.

- [ ] **Step 1: Instalar y PINNEAR `ulid`.**
Run: `cd Entregables/inti-maria-tidball/app/backend && npm install ulid` — luego leé la versión instalada (`node -e "console.log(require('ulid/package.json').version)"`) y editá `package.json` para fijar `ulid` a esa versión EXACTA (sin `^`), y `npm install` de nuevo para sincronizar el lock. (Consistente con el pinning del proyecto.)

- [ ] **Step 2: Escribir el test `test/tasks.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { createTask, listTasks, completeTask } from "../src/data/tasks";

function uniqueSub() { return `task-${Math.floor(performance.now() * 1000)}`; }

describe("tasks repository", () => {
  it("creates a task with open status and lists it", async () => {
    const sub = uniqueSub();
    const t = await createTask(sub, "regar las plantas");
    expect(t.id).toBeTruthy();
    expect(t.status).toBe("open");
    const tasks = await listTasks(sub);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe("regar las plantas");
  });

  it("completes a task, setting completedAt", async () => {
    const sub = uniqueSub();
    const t = await createTask(sub, "tomar agua");
    const done = await completeTask(sub, t.id);
    expect(done?.status).toBe("done");
    expect(done?.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const open = await listTasks(sub, "open");
    expect(open).toHaveLength(0);
    const doneList = await listTasks(sub, "done");
    expect(doneList).toHaveLength(1);
  });

  it("returns null when completing a non-existent task", async () => {
    const sub = uniqueSub();
    expect(await completeTask(sub, "01NONEXISTENT")).toBeNull();
  });

  it("isolates tasks by user", async () => {
    const a = uniqueSub(); const b = uniqueSub();
    await createTask(a, "solo de a");
    expect(await listTasks(b)).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run → verify FAIL.** `npx vitest run test/tasks.test.ts` → cannot find module '../src/data/tasks'.

- [ ] **Step 4: Implementar `src/data/tasks.ts`:**
```ts
import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { ulid } from "ulid";
import { makeDocClient, TABLE_NAME } from "./client";
import { userPk } from "./table";

const doc = makeDocClient();
const TASK_PREFIX = "TASK#";

export interface Task {
  id: string;
  text: string;
  status: "open" | "done";
  createdAt: string;
  completedAt?: string;
}

function toTask(i: Record<string, unknown>): Task {
  return {
    id: i.id as string,
    text: i.text as string,
    status: i.status as "open" | "done",
    createdAt: i.createdAt as string,
    completedAt: i.completedAt as string | undefined,
  };
}

export async function createTask(sub: string, text: string): Promise<Task> {
  const id = ulid();
  const createdAt = new Date().toISOString();
  const task: Task = { id, text, status: "open", createdAt };
  await doc.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { PK: userPk(sub), SK: `${TASK_PREFIX}${id}`, type: "task", ...task },
  }));
  return task;
}

export async function listTasks(sub: string, status?: "open" | "done"): Promise<Task[]> {
  const res = await doc.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :p)",
    ExpressionAttributeValues: { ":pk": userPk(sub), ":p": TASK_PREFIX },
  }));
  const tasks = (res.Items ?? []).map(toTask);
  return status ? tasks.filter((t) => t.status === status) : tasks;
}

export async function completeTask(sub: string, id: string): Promise<Task | null> {
  try {
    const res = await doc.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: userPk(sub), SK: `${TASK_PREFIX}${id}` },
      ConditionExpression: "attribute_exists(SK)",
      UpdateExpression: "SET #s = :done, completedAt = :c",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":done": "done", ":c": new Date().toISOString() },
      ReturnValues: "ALL_NEW",
    }));
    return toTask(res.Attributes ?? {});
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return null;
    throw err;
  }
}
```

- [ ] **Step 5: Run → verify PASS.** `npx vitest run test/tasks.test.ts` → 4 pass.

---

## Task 2: Repositorios de gratitud y perfil

**Files:** Create `src/data/gratitudes.ts`, `src/data/profile.ts`, `test/gratitudes.test.ts`, `test/profile.test.ts`.

- [ ] **Step 1: Escribir `test/gratitudes.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { createGratitude, listGratitudes } from "../src/data/gratitudes";

function uniqueSub() { return `grat-${Math.floor(performance.now() * 1000)}`; }

describe("gratitudes repository", () => {
  it("creates and lists a gratitude", async () => {
    const sub = uniqueSub();
    const g = await createGratitude(sub, "el sol de la mañana");
    expect(g.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const list = await listGratitudes(sub);
    expect(list).toHaveLength(1);
    expect(list[0].text).toBe("el sol de la mañana");
  });

  it("lists most-recent first", async () => {
    const sub = uniqueSub();
    await createGratitude(sub, "uno", "2026-08-01T10:00:00.000Z");
    await createGratitude(sub, "dos", "2026-08-02T10:00:00.000Z");
    const list = await listGratitudes(sub);
    expect(list.map((g) => g.text)).toEqual(["dos", "uno"]);
  });
});
```

- [ ] **Step 2: Escribir `test/profile.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { getProfile, putProfile } from "../src/data/profile";

function uniqueSub() { return `prof-${Math.floor(performance.now() * 1000)}`; }

describe("profile repository", () => {
  it("returns an empty profile when none exists", async () => {
    expect(await getProfile(uniqueSub())).toEqual({});
  });

  it("saves and returns a profile", async () => {
    const sub = uniqueSub();
    const saved = await putProfile(sub, {
      preferredSpecies: "capybara",
      locale: "es",
      emergencyContact: { name: "Ana", phone: "123" },
    });
    expect(saved.preferredSpecies).toBe("capybara");
    const got = await getProfile(sub);
    expect(got.emergencyContact).toEqual({ name: "Ana", phone: "123" });
    expect(got.locale).toBe("es");
  });
});
```

- [ ] **Step 3: Run → verify FAIL** (both): `npx vitest run test/gratitudes.test.ts test/profile.test.ts`.

- [ ] **Step 4: Implementar `src/data/gratitudes.ts`:**
```ts
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { makeDocClient, TABLE_NAME } from "./client";
import { userPk } from "./table";

const doc = makeDocClient();
const GRAT_PREFIX = "GRAT#";

export interface Gratitude {
  text: string;
  createdAt: string;
}

export async function createGratitude(
  sub: string, text: string, createdAt?: string,
): Promise<Gratitude> {
  const ts = createdAt ?? new Date().toISOString();
  await doc.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { PK: userPk(sub), SK: `${GRAT_PREFIX}${ts}`, type: "gratitude", text, createdAt: ts },
  }));
  return { text, createdAt: ts };
}

export async function listGratitudes(sub: string): Promise<Gratitude[]> {
  const res = await doc.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :p)",
    ExpressionAttributeValues: { ":pk": userPk(sub), ":p": GRAT_PREFIX },
    ScanIndexForward: false,
  }));
  return (res.Items ?? []).map((i) => ({ text: i.text as string, createdAt: i.createdAt as string }));
}
```

- [ ] **Step 5: Implementar `src/data/profile.ts`:**
```ts
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { makeDocClient, TABLE_NAME } from "./client";
import { userPk } from "./table";

const doc = makeDocClient();
const PROFILE_SK = "PROFILE";

export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface Profile {
  preferredSpecies?: string;
  locale?: string;
  emergencyContact?: EmergencyContact;
}

export async function getProfile(sub: string): Promise<Profile> {
  const res = await doc.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: userPk(sub), SK: PROFILE_SK },
  }));
  if (!res.Item) return {};
  return {
    preferredSpecies: res.Item.preferredSpecies,
    locale: res.Item.locale,
    emergencyContact: res.Item.emergencyContact,
  };
}

export async function putProfile(sub: string, profile: Profile): Promise<Profile> {
  await doc.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { PK: userPk(sub), SK: PROFILE_SK, type: "profile", ...profile },
  }));
  return profile;
}
```

- [ ] **Step 6: Run → verify PASS.** `npx vitest run test/gratitudes.test.ts test/profile.test.ts` → 2 + 2 pass.

---

## Task 3: Streak (función pura) + Dashboard (agregación single-query)

**Files:** Create `src/data/streak.ts`, `src/data/dashboard.ts`, `test/streak.test.ts`, `test/dashboard.test.ts`.

- [ ] **Step 1: Escribir `test/streak.test.ts` (pura, sin DB):**
```ts
import { describe, it, expect } from "vitest";
import { computeStreak } from "../src/data/streak";

describe("computeStreak", () => {
  it("is 0 with no days", () => {
    expect(computeStreak([], "2026-08-04")).toBe(0);
  });
  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-08-04", "2026-08-03", "2026-08-02"], "2026-08-04")).toBe(3);
  });
  it("counts a streak ending yesterday (grace) ", () => {
    expect(computeStreak(["2026-08-03", "2026-08-02"], "2026-08-04")).toBe(2);
  });
  it("stops at a gap", () => {
    expect(computeStreak(["2026-08-04", "2026-08-01"], "2026-08-04")).toBe(1);
  });
  it("dedupes multiple entries on the same day", () => {
    expect(computeStreak(["2026-08-04", "2026-08-04", "2026-08-03"], "2026-08-04")).toBe(2);
  });
});
```

- [ ] **Step 2: Run → verify FAIL.** `npx vitest run test/streak.test.ts`.

- [ ] **Step 3: Implementar `src/data/streak.ts`:**
```ts
/**
 * Racha de días consecutivos (hasta hoy o ayer) con al menos una actividad.
 * `days`: fechas YYYY-MM-DD (pueden repetirse/desordenarse). `today`: YYYY-MM-DD.
 * Se permite gracia de 1 día: si hoy no hay registro pero ayer sí, la racha sigue.
 */
export function computeStreak(days: string[], today: string): number {
  const set = new Set(days);
  if (set.size === 0) return 0;

  const toMs = (d: string) => Date.parse(`${d}T00:00:00.000Z`);
  const dayMs = 86_400_000;
  const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);

  const todayMs = toMs(today);
  // El ancla es hoy si hay registro hoy; si no, ayer (gracia).
  let cursor: number;
  if (set.has(today)) cursor = todayMs;
  else if (set.has(fmt(todayMs - dayMs))) cursor = todayMs - dayMs;
  else return 0;

  let streak = 0;
  while (set.has(fmt(cursor))) {
    streak++;
    cursor -= dayMs;
  }
  return streak;
}
```

- [ ] **Step 4: Escribir `test/dashboard.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { getDashboard } from "../src/data/dashboard";
import { createMood } from "../src/data/moods";
import { createTask, completeTask } from "../src/data/tasks";
import { createGratitude } from "../src/data/gratitudes";
import { putProfile } from "../src/data/profile";

function uniqueSub() { return `dash-${Math.floor(performance.now() * 1000)}`; }

describe("getDashboard", () => {
  it("assembles profile, moods, tasks, gratitudes and stats in one view", async () => {
    const sub = uniqueSub();
    await putProfile(sub, { preferredSpecies: "cat", locale: "es" });
    await createMood(sub, { mood: "tranquila" });
    const t1 = await createTask(sub, "abrir la ventana");
    const t2 = await createTask(sub, "estirar");
    await completeTask(sub, t2.id);
    await createGratitude(sub, "un té caliente");

    const d = await getDashboard(sub);
    expect(d.profile.preferredSpecies).toBe("cat");
    expect(d.moods).toHaveLength(1);
    expect(d.tasks.open).toHaveLength(1);
    expect(d.tasks.done).toHaveLength(1);
    expect(d.gratitudes).toHaveLength(1);
    expect(d.stats.tasksDone).toBe(1);
    expect(d.stats.streakDays).toBeGreaterThanOrEqual(1);
  });

  it("returns empty structures for a new user", async () => {
    const d = await getDashboard(uniqueSub());
    expect(d.profile).toEqual({});
    expect(d.moods).toEqual([]);
    expect(d.tasks).toEqual({ open: [], done: [] });
    expect(d.gratitudes).toEqual([]);
    expect(d.stats.tasksDone).toBe(0);
    expect(d.stats.streakDays).toBe(0);
  });
});
```

- [ ] **Step 5: Run → verify FAIL.** `npx vitest run test/dashboard.test.ts`.

- [ ] **Step 6: Implementar `src/data/dashboard.ts`:**
```ts
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { makeDocClient, TABLE_NAME } from "./client";
import { userPk } from "./table";
import { computeStreak } from "./streak";
import type { Mood } from "./moods";
import type { Task } from "./tasks";
import type { Gratitude } from "./gratitudes";
import type { Profile } from "./profile";

const doc = makeDocClient();

export interface Dashboard {
  profile: Profile;
  moods: Mood[];
  tasks: { open: Task[]; done: Task[] };
  gratitudes: Gratitude[];
  stats: { tasksDone: number; streakDays: number };
}

/** Una sola Query a la partición del usuario arma toda la vista. */
export async function getDashboard(sub: string, today?: string): Promise<Dashboard> {
  const res = await doc.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": userPk(sub) },
  }));
  const items = res.Items ?? [];

  let profile: Profile = {};
  const moods: Mood[] = [];
  const open: Task[] = [];
  const done: Task[] = [];
  const gratitudes: Gratitude[] = [];

  for (const i of items) {
    const sk = i.SK as string;
    if (sk === "PROFILE") {
      profile = { preferredSpecies: i.preferredSpecies, locale: i.locale, emergencyContact: i.emergencyContact };
    } else if (sk.startsWith("MOOD#")) {
      moods.push({ mood: i.mood, note: i.note, createdAt: i.createdAt });
    } else if (sk.startsWith("TASK#")) {
      const t: Task = { id: i.id, text: i.text, status: i.status, createdAt: i.createdAt, completedAt: i.completedAt };
      (t.status === "done" ? done : open).push(t);
    } else if (sk.startsWith("GRAT#")) {
      gratitudes.push({ text: i.text, createdAt: i.createdAt });
    }
  }

  moods.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  gratitudes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const day = today ?? new Date().toISOString().slice(0, 10);
  const moodDays = moods.map((m) => m.createdAt.slice(0, 10));
  const stats = { tasksDone: done.length, streakDays: computeStreak(moodDays, day) };

  return { profile, moods, tasks: { open, done }, gratitudes, stats };
}
```

- [ ] **Step 7: Run → verify PASS.** `npx vitest run test/streak.test.ts test/dashboard.test.ts`.

---

## Task 4: Rutas nuevas en la app Hono

**Files:** Modify `src/app.ts`; Modify `test/app.test.ts` (agregar casos).

- [ ] **Step 1: Agregar tests al final del `describe` de `test/app.test.ts`** (dentro del mismo archivo, reutilizando `sign`/`app`). Agregar este bloque nuevo `describe`:
```ts
describe("domain API", () => {
  async function authed(path: string, init: RequestInit = {}) {
    const token = await sign(`dom-${Math.floor(performance.now() * 1000)}`);
    return app.request(path, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  }

  it("creates and lists tasks", async () => {
    const token = await sign(`dom-tasks-${Math.floor(performance.now() * 1000)}`);
    const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const post = await app.request("/tasks", { method: "POST", headers: h, body: JSON.stringify({ text: "respirar" }) });
    expect(post.status).toBe(201);
    const { id } = await post.json();
    const patch = await app.request(`/tasks/${id}`, { method: "PATCH", headers: h });
    expect(patch.status).toBe(200);
    const get = await app.request("/tasks?status=done", { headers: h });
    expect((await get.json()).tasks).toHaveLength(1);
  });

  it("rejects an empty task", async () => {
    const res = await authed("/tasks", { method: "POST", body: JSON.stringify({ text: "" }) });
    expect(res.status).toBe(400);
  });

  it("creates and lists gratitudes", async () => {
    const token = await sign(`dom-grat-${Math.floor(performance.now() * 1000)}`);
    const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    await app.request("/gratitudes", { method: "POST", headers: h, body: JSON.stringify({ text: "silencio" }) });
    const get = await app.request("/gratitudes", { headers: h });
    expect((await get.json()).gratitudes).toHaveLength(1);
  });

  it("gets and updates the profile", async () => {
    const token = await sign(`dom-prof-${Math.floor(performance.now() * 1000)}`);
    const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    await app.request("/me", { method: "PUT", headers: h, body: JSON.stringify({ preferredSpecies: "bird" }) });
    const get = await app.request("/me", { headers: h });
    expect((await get.json()).preferredSpecies).toBe("bird");
  });

  it("returns a dashboard", async () => {
    const token = await sign(`dom-dash-${Math.floor(performance.now() * 1000)}`);
    const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    await app.request("/moods", { method: "POST", headers: h, body: JSON.stringify({ mood: "ok" }) });
    const get = await app.request("/dashboard", { headers: h });
    const d = await get.json();
    expect(d.moods).toHaveLength(1);
    expect(d.stats).toBeDefined();
  });
});
```

- [ ] **Step 2: Run → verify FAIL** (rutas nuevas 404). `npx vitest run test/app.test.ts`.

- [ ] **Step 3: Extender `createApp` en `src/app.ts`.** Ampliar `AppDeps` y agregar rutas. Reemplazar el archivo por:
```ts
import { Hono } from "hono";
import { createAuth, type AuthConfig } from "./auth/oidc";
import type { Mood, CreateMoodInput } from "./data/moods";
import type { Task } from "./data/tasks";
import type { Gratitude } from "./data/gratitudes";
import type { Profile } from "./data/profile";
import type { Dashboard } from "./data/dashboard";

export interface MoodsRepo {
  createMood(sub: string, input: CreateMoodInput): Promise<Mood>;
  listMoods(sub: string, range?: { from?: string; to?: string }): Promise<Mood[]>;
}
export interface TasksRepo {
  createTask(sub: string, text: string): Promise<Task>;
  listTasks(sub: string, status?: "open" | "done"): Promise<Task[]>;
  completeTask(sub: string, id: string): Promise<Task | null>;
}
export interface GratitudesRepo {
  createGratitude(sub: string, text: string): Promise<Gratitude>;
  listGratitudes(sub: string): Promise<Gratitude[]>;
}
export interface ProfileRepo {
  getProfile(sub: string): Promise<Profile>;
  putProfile(sub: string, profile: Profile): Promise<Profile>;
}

export interface AppDeps {
  auth: AuthConfig;
  moods: MoodsRepo;
  tasks: TasksRepo;
  gratitudes: GratitudesRepo;
  profile: ProfileRepo;
  getDashboard(sub: string): Promise<Dashboard>;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  app.use("*", createAuth(deps.auth));

  app.post("/moods", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const mood = typeof body.mood === "string" ? body.mood.trim() : "";
    if (!mood) return c.json({ error: "mood is required" }, 400);
    return c.json(await deps.moods.createMood(c.get("sub"), { mood, note: body.note }), 201);
  });
  app.get("/moods", async (c) => {
    const moods = await deps.moods.listMoods(c.get("sub"), { from: c.req.query("from"), to: c.req.query("to") });
    return c.json({ moods });
  });

  app.post("/tasks", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return c.json({ error: "text is required" }, 400);
    return c.json(await deps.tasks.createTask(c.get("sub"), text), 201);
  });
  app.patch("/tasks/:id", async (c) => {
    const done = await deps.tasks.completeTask(c.get("sub"), c.req.param("id"));
    return done ? c.json(done) : c.json({ error: "task not found" }, 404);
  });
  app.get("/tasks", async (c) => {
    const status = c.req.query("status");
    const s = status === "open" || status === "done" ? status : undefined;
    return c.json({ tasks: await deps.tasks.listTasks(c.get("sub"), s) });
  });

  app.post("/gratitudes", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return c.json({ error: "text is required" }, 400);
    return c.json(await deps.gratitudes.createGratitude(c.get("sub"), text), 201);
  });
  app.get("/gratitudes", async (c) => {
    return c.json({ gratitudes: await deps.gratitudes.listGratitudes(c.get("sub")) });
  });

  app.get("/me", async (c) => c.json(await deps.profile.getProfile(c.get("sub"))));
  app.put("/me", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Profile;
    return c.json(await deps.profile.putProfile(c.get("sub"), body));
  });

  app.get("/dashboard", async (c) => c.json(await deps.getDashboard(c.get("sub"))));

  return app;
}
```

- [ ] **Step 4: Actualizar `src/server.ts`** para inyectar las nuevas deps. Reemplazar el objeto pasado a `createApp` por:
```ts
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { authFromEnv } from "./auth/oidc";
import { createMood, listMoods } from "./data/moods";
import { createTask, listTasks, completeTask } from "./data/tasks";
import { createGratitude, listGratitudes } from "./data/gratitudes";
import { getProfile, putProfile } from "./data/profile";
import { getDashboard } from "./data/dashboard";

const app = createApp({
  auth: authFromEnv(),
  moods: { createMood, listMoods },
  tasks: { createTask, listTasks, completeTask },
  gratitudes: { createGratitude, listGratitudes },
  profile: { getProfile, putProfile },
  getDashboard,
});

const port = Number(process.env.PORT || 8080);
serve({ fetch: app.fetch, port });
console.log(`gentle-backend escuchando en :${port}`);
```

- [ ] **Step 5: Actualizar el `createApp(...)` en `test/app.test.ts`** (el bloque `beforeAll`) para inyectar las nuevas deps (importar los repos reales):
```ts
// añadir imports arriba del archivo:
import { createTask, listTasks, completeTask } from "../src/data/tasks";
import { createGratitude, listGratitudes } from "../src/data/gratitudes";
import { getProfile, putProfile } from "../src/data/profile";
import { getDashboard } from "../src/data/dashboard";
// y reemplazar el createApp({...}) del beforeAll por:
app = createApp({
  auth: { jwks, issuer: ISSUER, audience: AUDIENCE },
  moods: { createMood, listMoods },
  tasks: { createTask, listTasks, completeTask },
  gratitudes: { createGratitude, listGratitudes },
  profile: { getProfile, putProfile },
  getDashboard,
});
```

- [ ] **Step 6: Run TODA la suite → PASS.** `npm test` → Plan 1 (11) + tasks (4) + gratitudes (2) + profile (2) + streak (5) + dashboard (2) + domain API (5) = 31 tests.

---

## Task 5: Tests self-contained (DynamoDB Local pinneado)

**Files:** Create `scripts/ensure-ddb.sh`; Modify `package.json` (script `pretest`).

- [ ] **Step 1: Crear `scripts/ensure-ddb.sh`:**
```bash
#!/usr/bin/env bash
# Arranca DynamoDB Local (pinneado) en :8000 para los tests de integración, idempotente.
set -euo pipefail
NAME=gentle-ddb-test
IMG=amazon/dynamodb-local:2.5.2
if [ -z "$(docker ps -q -f name="^${NAME}$")" ]; then
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker run -d --name "$NAME" -p 8000:8000 "$IMG" >/dev/null
  # esperar a que escuche
  for _ in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000 || true)
    [ "$code" = "400" ] && break
    sleep 0.5
  done
fi
echo "DynamoDB Local ($IMG) listo en :8000"
```

- [ ] **Step 2: Verificar el tag de la imagen.** Run: `docker pull amazon/dynamodb-local:2.5.2`. Si ese tag NO existe, elegir un tag concreto existente (consultar `https://gallery.ecr.aws/aws-dynamodb-local/dynamodb-local` o Docker Hub) y usar ese — NUNCA `:latest`. Ajustar `IMG` al tag verificado.

- [ ] **Step 3: Agregar el script `pretest` a `package.json`** (dentro de `scripts`):
```json
"pretest": "bash scripts/ensure-ddb.sh",
```
(npm corre `pretest` automáticamente antes de `test`.)

- [ ] **Step 4: chmod + correr toda la suite desde limpio.**
Run: `chmod +x scripts/ensure-ddb.sh && docker rm -f gentle-ddb-test 2>/dev/null; npm test`
Expected: `pretest` levanta DynamoDB Local pinneado y los 31 tests pasan.

---

## Self-Review

**Spec coverage (spec §4–§5):** tasks con completedAt (T1), gratitud diario (T2), perfil + contacto de emergencia embebido (T2), dashboard single-query (T3), stats/racha (T3), rutas `/tasks` `/gratitudes` `/me` `/dashboard` con aislamiento por `sub` del token (T4). ✔ Vistas de historial: moods (Plan 1), tareas completadas (`listTasks("done")`), diario (`listGratitudes`), racha (`computeStreak`). ✔

**No cubierto (declarado):** UI Next.js (Plan 3), feature animalitos (Plan 4). Cifrado at-rest: en el build AWS (KMS) / homelab.

**Placeholder scan:** sin TBD/TODO; todo con código o comando concreto. ✔

**Type consistency:** `Task`/`Mood`/`Gratitude`/`Profile`/`Dashboard` importados desde sus repos y reusados en `AppDeps`; firmas de `createTask`/`completeTask`/`getDashboard` idénticas en repo, DI, server y tests. `completeTask` devuelve `Task|null` (404 en la ruta). ✔
