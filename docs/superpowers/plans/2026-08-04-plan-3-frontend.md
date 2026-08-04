# Plan 3 — Frontend Next.js (UI conectada al backend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Conectar la PWA Next.js (gentle-task-companion) al backend portable: **login OIDC** (authorization_code + PKCE), y las pantallas de **dashboard / ánimo / tareas / gratitud** contra los endpoints reales. El *companion* (animalitos) NO entra acá (su backend es el Plan 4).

**Architecture:** Es un **rediseño**, no un swap. Se saca `@supabase/supabase-js`. Auth pasa a OIDC redirect (`oidc-client-ts`). Los datos pasan de "autoguardar una entrada diaria (delete+recreate)" a **acciones discretas** contra la API (`/moods`, `/tasks`, `/gratitudes`, `/dashboard`). Se conserva la UI (componentes, i18n, PWA, página de crisis, audios).

**Decisiones de mapeo (aprobadas):**
- Auth: botón "Iniciar sesión" → redirect al IdP; ruta `/auth/callback`. Emisor por env (mock-oidc dev / Authentik-Cognito prod).
- Tareas: UI de 3 estados → backend `open|done`. `not_started`/`in_progress` ⇒ `open`; `completed` ⇒ `done` (setea `completedAt` vía `PATCH /tasks/:id`).
- Ánimo: cada selección = un check-in (`POST /moods`). Carga del día vía `GET /dashboard`.
- Contacto de crisis: `emergencyContact` dentro de `GET/PUT /me` (ya no tabla `contacts`).
- `useDailyState` (localStorage) se conserva como caché optimista/offline.

**Tech Stack:** Next.js 15.1.8 (App Router, React 19), next-pwa 5.6.0, tailwind 3.4.17, + `oidc-client-ts` (nuevo, pinneado). Se saca `@supabase/supabase-js`.

**Directorio de trabajo:** `Entregables/inti-maria-tidball/app/frontend/` (repo `arq-nube-2026`, rama `entrega/inti-maria-tidball`). NO commitear (la usuaria commitea). El backend ya expone: `GET /dashboard`, `POST/GET /moods`, `POST /tasks` `PATCH /tasks/:id` `GET /tasks?status=`, `POST/GET /gratitudes`, `GET/PUT /me`.

**Contrato de la API (del backend, ya implementado):**
- `GET /dashboard` → `{ profile, moods:[{mood,note?,createdAt}], tasks:{open:[{id,text,status,createdAt,completedAt?}],done:[...]}, gratitudes:[{text,createdAt}], stats:{tasksDone,streakDays} }`
- `POST /moods {mood,note?}` → 201 `{mood,note?,createdAt}`
- `POST /tasks {text}` → 201 `{id,text,status:"open",createdAt}` · `PATCH /tasks/:id` → `{...,status:"done",completedAt}` · `GET /tasks?status=open|done` → `{tasks:[...]}`
- `POST /gratitudes {text}` → 201 · `GET /gratitudes` → `{gratitudes:[...]}`
- `GET /me` → `{preferredSpecies?,locale?,emergencyContact?:{name,phone}}` · `PUT /me {...}` → el perfil
- Todos requieren `Authorization: Bearer <jwt>`.

---

## Task 1: Copiar la app + ajustar deps

**Files:** copiar el árbol de `gentle-task-companion` a `app/frontend/`; modificar `app/frontend/package.json`, `app/frontend/next.config.ts`.

- [ ] **Step 1: Copiar el código fuente** (sin `node_modules`, `.git`, `.next`, `.env*`):
```bash
SRC=/home/inti/trabajo/soletrader/gentle-task-companion
DST=/home/inti/trabajo/soletrader/aws-women-in-cloud/arq-nube-2026/Entregables/inti-maria-tidball/app/frontend
mkdir -p "$DST"
rsync -a --exclude node_modules --exclude .git --exclude .next --exclude 'docs/superpowers' --exclude '.env*' "$SRC"/ "$DST"/
```

- [ ] **Step 2: Crear `app/frontend/.gitignore`** con:
```
node_modules/
.next/
.env
.env.local
```

- [ ] **Step 3: Editar `package.json`:** quitar `"@supabase/supabase-js"` de `dependencies`; agregar `"oidc-client-ts"` (instalar y luego PINNEAR a la versión exacta instalada, sin `^`). Luego `npm install`.

- [ ] **Step 4: Editar `next.config.ts`** para build en contenedor — agregar `output: "standalone"` al objeto que envuelve `withPWA`:
```ts
module.exports = withPWA({
  output: "standalone",
});
```

- [ ] **Step 5:** `npm install` OK. (El `next build` todavía fallará por refs a supabase — se arregla en T2-T5; no se corre build aún.)

---

## Task 2: Auth OIDC (reemplaza Supabase auth)

**Files:** Create `src/lib/oidc.ts`, `src/app/auth/callback/page.tsx`; Rewrite `src/hooks/useAuth.tsx`; Delete `src/lib/supabaseClient.ts`.

- [ ] **Step 1: Crear `src/lib/oidc.ts`:**
```ts
import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";

// Config OIDC portable (mock-oidc en dev; Authentik/Cognito en prod), por env NEXT_PUBLIC_*.
export const userManager = new UserManager({
  authority: process.env.NEXT_PUBLIC_OIDC_AUTHORITY!,
  client_id: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID!,
  redirect_uri: process.env.NEXT_PUBLIC_OIDC_REDIRECT_URI!,
  response_type: "code",
  scope: "openid profile",
  userStore: typeof window !== "undefined"
    ? new WebStorageStateStore({ store: window.localStorage })
    : undefined,
});

export async function getAccessToken(): Promise<string | null> {
  const user = await userManager.getUser();
  return user?.access_token ?? null;
}

export type { User };
```

- [ ] **Step 2: Reescribir `src/hooks/useAuth.tsx`** (mismo shape de contexto que consume la UI, pero OIDC):
```tsx
"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { userManager, type User } from "../lib/oidc";

interface AuthContextType {
  user: { id: string; email?: string } | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextType["user"]>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userManager.getUser().then((u: User | null) => {
      if (u && !u.expired) setUser({ id: u.profile.sub, email: u.profile.email as string | undefined });
      setLoading(false);
    });
    const onLoaded = (u: User) => setUser({ id: u.profile.sub, email: u.profile.email as string | undefined });
    const onUnloaded = () => setUser(null);
    userManager.events.addUserLoaded(onLoaded);
    userManager.events.addUserUnloaded(onUnloaded);
    return () => {
      userManager.events.removeUserLoaded(onLoaded);
      userManager.events.removeUserUnloaded(onUnloaded);
    };
  }, []);

  const signIn = () => userManager.signinRedirect();
  const signOut = async () => { await userManager.removeUser(); setUser(null); };

  return <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 3: Crear `src/app/auth/callback/page.tsx`:**
```tsx
"use client";
import { useEffect } from "react";
import { userManager } from "../../../lib/oidc";

export default function AuthCallback() {
  useEffect(() => {
    userManager.signinRedirectCallback()
      .then(() => { window.location.replace("/"); })
      .catch(() => { window.location.replace("/"); });
  }, []);
  return <p style={{ padding: 24 }}>Iniciando sesión…</p>;
}
```

- [ ] **Step 4: Borrar** `src/lib/supabaseClient.ts`.

- [ ] **Step 5:** Verificar que no queden imports colgando de `supabaseClient` fuera de `dailyEntryApi.tsx`/`crisis` (se arreglan en T3-T5): `grep -rn "supabaseClient\|@supabase" src` — anotar los que queden para las tasks siguientes.

---

## Task 3: Cliente API tipado

**Files:** Create `src/lib/api.ts`, `src/types/api.ts`.

- [ ] **Step 1: Crear `src/types/api.ts`:**
```ts
export interface Mood { mood: string; note?: string; createdAt: string; }
export interface ApiTask { id: string; text: string; status: "open" | "done"; createdAt: string; completedAt?: string; }
export interface ApiGratitude { text: string; createdAt: string; }
export interface Profile { preferredSpecies?: string; locale?: string; emergencyContact?: { name: string; phone: string }; }
export interface Dashboard {
  profile: Profile;
  moods: Mood[];
  tasks: { open: ApiTask[]; done: ApiTask[] };
  gratitudes: ApiGratitude[];
  stats: { tasksDone: number; streakDays: number };
}
```

- [ ] **Step 2: Crear `src/lib/api.ts`:**
```ts
import { getAccessToken } from "./oidc";
import type { Dashboard, Mood, ApiTask, ApiGratitude, Profile } from "../types/api";

const BASE = process.env.NEXT_PUBLIC_API_URL!;

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  getDashboard: () => req<Dashboard>("/dashboard"),
  addMood: (mood: string, note?: string) => req<Mood>("/moods", { method: "POST", body: JSON.stringify({ mood, note }) }),
  addTask: (text: string) => req<ApiTask>("/tasks", { method: "POST", body: JSON.stringify({ text }) }),
  completeTask: (id: string) => req<ApiTask>(`/tasks/${id}`, { method: "PATCH" }),
  listTasks: (status?: "open" | "done") => req<{ tasks: ApiTask[] }>(`/tasks${status ? `?status=${status}` : ""}`),
  addGratitude: (text: string) => req<ApiGratitude>("/gratitudes", { method: "POST", body: JSON.stringify({ text }) }),
  listGratitudes: () => req<{ gratitudes: ApiGratitude[] }>("/gratitudes"),
  getProfile: () => req<Profile>("/me"),
  putProfile: (p: Profile) => req<Profile>("/me", { method: "PUT", body: JSON.stringify(p) }),
};
```

---

## Task 4: Rewire de la home (`src/app/page.tsx`)

**Files:** Modify `src/app/page.tsx`; Rewrite `src/lib/dailyEntryApi.tsx` (o eliminarlo si queda sin uso).

Contexto: `page.tsx` hoy usa `useAuth()` (con `signUp/signIn/signOut` + form email/password), `useDailyState()`, y autoguarda con `saveFullEntry`. Objetivo: adaptarlo al nuevo `useAuth` (solo `signIn/signOut`) y a acciones discretas de la API.

- [ ] **Step 1: Leer `src/app/page.tsx` completo** para entender el JSX actual antes de editar.

- [ ] **Step 2: Auth UI.** Reemplazar el form inline de email/password por un botón "Iniciar sesión" que llame `signIn()`. Mantener el saludo + botón de cerrar sesión (`signOut()`). Quitar el estado local de email/password/authError.

- [ ] **Step 3: Carga inicial.** Reemplazar la carga de "entry de hoy" por `api.getDashboard()` en un `useEffect` cuando `user` existe. Poblar el estado local (tareas open+done, ánimo más reciente, gratitudes) desde el dashboard.

- [ ] **Step 4: Acciones discretas** (reemplazar el auto-save `saveFullEntry`):
  - Seleccionar ánimo → `await api.addMood(mood)`.
  - Agregar tarea → `await api.addTask(text)` (usar el `id` devuelto en el estado).
  - Marcar tarea completada (UI: `completed`) → `await api.completeTask(id)`. Mapear estados: `not_started`/`in_progress` = `open` (no llama API salvo creación); `completed` = `done`.
  - Agregar gratitud → `await api.addGratitude(text)`.
  Quitar el `useEffect` de auto-save global.

- [ ] **Step 5: Historial.** Reemplazar la query Supabase de "últimos 30 días" por datos del dashboard / `api.listTasks("done")` / `api.listGratitudes()` / `api.getDashboard().moods` (trayectoria de ánimo). Mostrar: trayectoria de ánimo, tareas completadas, diario de gratitud, racha (`stats.streakDays`).

- [ ] **Step 6:** Eliminar `src/lib/dailyEntryApi.tsx` (o dejar solo lo que se siga usando). Quitar imports muertos.

- [ ] **Step 7:** `npx tsc --noEmit` (o `next lint`) sin errores en `page.tsx`.

---

## Task 5: Rewire de la página de crisis (`src/app/crisis/page.tsx`)

**Files:** Modify `src/app/crisis/page.tsx`.

- [ ] **Step 1: Leer `src/app/crisis/page.tsx`.**
- [ ] **Step 2:** Reemplazar `supabase.auth.getUser()` + `fetchContact/saveContact` por el nuevo auth y `api.getProfile()`/`api.putProfile({ emergencyContact: { name, phone } })`. El contacto de emergencia vive en `profile.emergencyContact`.
- [ ] **Step 3:** Los audios (hoy en Supabase Storage) se dejan como están por ahora (migrar a S3/MinIO = futuro; anotar). No bloquea el demo.
- [ ] **Step 4:** Quitar imports de supabase. `grep -rn "@supabase\|supabaseClient" src` debe volver vacío.

---

## Task 6: docker-compose (frontend) + OIDC de navegador

**Files:** Create `app/frontend/Dockerfile`, `app/frontend/.env.example`; Modify `app/docker-compose.yml` (mock-oidc interactivo + servicio frontend).

Nota clave (consistencia de issuer): el navegador obtiene el token vía `localhost:8081`, así que `iss = http://localhost:8081/default`. El backend valida ese `iss` pero busca el JWKS desde adentro de docker. Solución: `OIDC_ISSUER=http://localhost:8081/default` y `OIDC_JWKS_URI=http://host.docker.internal:8081/default/jwks` en el backend (+ `extra_hosts: ["host.docker.internal:host-gateway"]`).

- [ ] **Step 1: `app/frontend/Dockerfile`** (Next standalone, node pinneado igual que el backend `node:20.18.1-slim`):
```dockerfile
FROM node:20.18.1-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20.18.1-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 2: `app/frontend/.env.example`:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_OIDC_AUTHORITY=http://localhost:8081/default
NEXT_PUBLIC_OIDC_CLIENT_ID=gentle
NEXT_PUBLIC_OIDC_REDIRECT_URI=http://localhost:3000/auth/callback
```
(estos `NEXT_PUBLIC_*` se hornean en build; pasarlos como build args o `.env` al `npm run build`.)

- [ ] **Step 3: Actualizar el servicio `mock-oidc`** en `docker-compose.yml` para login interactivo y claims por auth-code. Cambiar su `JSON_CONFIG` a:
```
{"interactiveLogin":true,"httpServer":"NettyWrapper","tokenCallbacks":[{"issuerId":"default","tokenExpiry":3600,"requestMappings":[{"requestParam":"scope","match":"openid.*","claims":{"aud":["gentle"]}}]}]}
```
(con `interactiveLogin:true`, mock-oauth2-server muestra una pantalla de login; el `sub` sale de lo que se ingresa; `aud=gentle` para que el backend lo acepte.)

- [ ] **Step 4: Backend en el compose** — agregar al servicio `backend`:
```yaml
    extra_hosts:
      - "host.docker.internal:host-gateway"
```
y en `app/.env.example` cambiar el bloque OIDC a:
```bash
OIDC_ISSUER=http://localhost:8081/default
OIDC_JWKS_URI=http://host.docker.internal:8081/default/jwks
OIDC_AUDIENCE=gentle
```

- [ ] **Step 5: Agregar el servicio `frontend`** a `docker-compose.yml`:
```yaml
  frontend:
    build:
      context: ./frontend
      args:
        NEXT_PUBLIC_API_URL: http://localhost:8080
        NEXT_PUBLIC_OIDC_AUTHORITY: http://localhost:8081/default
        NEXT_PUBLIC_OIDC_CLIENT_ID: gentle
        NEXT_PUBLIC_OIDC_REDIRECT_URI: http://localhost:3000/auth/callback
    depends_on:
      - backend
      - mock-oidc
    ports:
      - "3000:3000"
```
(y en el `Dockerfile` del frontend, declarar los `ARG NEXT_PUBLIC_*` y `ENV` antes de `npm run build` para que se horneen.)

- [ ] **Step 6: Verificación que SÍ se puede automatizar:**
  - `docker compose build frontend` → build OK (compila, sin refs a supabase).
  - `docker compose up -d` → `frontend` responde `200` en `http://localhost:3000` (`curl -s -o /dev/null -w '%{http_code}' http://localhost:3000`), backend healthy, mock-oidc up.
  - Verificar CORS: el backend Hono debe permitir el origin `http://localhost:3000` (si falta, agregar `hono/cors` al `app.ts` del backend — anotar como ajuste).
  - **Verificación de login (manual, la hace la usuaria):** abrir `http://localhost:3000`, click "Iniciar sesión", loguear en la pantalla del mock, y confirmar que el dashboard carga y se puede registrar un ánimo/tarea/gratitud. (No automatizable acá sin headless browser.)

- [ ] **Step 7:** `docker compose down`.

---

## Self-Review

**Spec coverage:** login OIDC portable (T2/T6), cliente API con Bearer (T3), vistas ánimo/tareas/gratitud/dashboard/racha (T4), contacto de emergencia en `/me` (T5), frontend dockerizado + issuer consistente (T6). Companion → Plan 4 (declarado).

**Placeholder scan:** sin TBD; módulos nuevos con código exacto; las tasks de rewire (T4/T5) dan contrato + decisiones y requieren adaptar JSX existente (trabajo de integración, se lee el archivo primero).

**Riesgos conocidos:** (1) CORS backend→ agregar `hono/cors` si hace falta. (2) Consistencia de `iss` navegador/backend → resuelto con `localhost:8081` + `host.docker.internal` (T6). (3) `NEXT_PUBLIC_*` se hornean en build → pasarlos como build args. (4) El click-through del login no se verifica acá; lo valida la usuaria en el browser.

**Type consistency:** `api.ts` usa los tipos de `types/api.ts`; `useAuth` expone `{user:{id,email?},loading,signIn,signOut}` consumido por `page.tsx`/`crisis`.
