import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth, type AuthConfig } from "./auth/oidc";
import type { Mood, CreateMoodInput } from "./data/moods";
import type { Task } from "./data/tasks";
import type { Gratitude } from "./data/gratitudes";
import type { Profile } from "./data/profile";
import type { Dashboard } from "./data/dashboard";
import type { AnimalImage } from "./data/companion";
import { isSpecies, isSupported } from "./data/companion";
import type { SavedAnimal } from "./data/storage";
import type { MediaItem } from "./data/media";
import { isMediaKind } from "./data/media";

function isAdmin(sub: string, groups: string[]): boolean {
  if (groups.includes("admin")) return true;
  // Dev: mock-oidc no da groups por-usuario; permitir por sub via env.
  const adminSubs = (process.env.ADMIN_SUBS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return adminSubs.includes(sub);
}

export interface MoodsRepo {
  createMood(sub: string, input: CreateMoodInput): Promise<Mood>;
  listMoods(sub: string, range?: { from?: string; to?: string }): Promise<Mood[]>;
  deleteMood(sub: string, createdAt: string): Promise<void>;
}
export interface TasksRepo {
  createTask(sub: string, text: string): Promise<Task>;
  listTasks(sub: string, status?: "not_started" | "in_progress" | "completed"): Promise<Task[]>;
  updateTaskStatus(sub: string, id: string, status: "not_started" | "in_progress" | "completed"): Promise<Task | null>;
  deleteTask(sub: string, id: string): Promise<void>;
}
export interface GratitudesRepo {
  createGratitude(sub: string, text: string): Promise<Gratitude>;
  listGratitudes(sub: string): Promise<Gratitude[]>;
  deleteGratitude(sub: string, createdAt: string): Promise<void>;
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
  getRandomAnimal(species: string): Promise<AnimalImage>;
  saveAnimal(sub: string, species: string, url: string): Promise<{ id: string }>;
  listSaved(sub: string): Promise<SavedAnimal[]>;
  listMedia(kind?: "sound" | "meditation"): Promise<MediaItem[]>;
  createUploadUrl(kind: "sound" | "meditation", contentType: string): Promise<{ id: string; s3Key: string; putUrl: string }>;
  confirmMedia(item: { id: string; name: string; kind: "sound" | "meditation"; s3Key: string; contentType: string }): Promise<void>;
  deleteMedia(kind: "sound" | "meditation", id: string): Promise<void>;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  // CORS antes del auth: el preflight OPTIONS no lleva token.
  // Detrás de API Gateway (build AWS-emulado) el CORS lo maneja el gateway; si además lo
  // emitiera la app habría headers duplicados. Por eso se apaga con SKIP_APP_CORS=1.
  // En self-host (sin gateway) queda activo.
  if (process.env.SKIP_APP_CORS !== "1") {
    app.use(
      "*",
      cors({
        origin: process.env.FRONTEND_ORIGIN || "*",
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      }),
    );
  }
  const auth = createAuth(deps.auth);
  // GET /companion y GET /media son PÚBLICOS. El resto requiere auth.
  app.use("*", (c, next) => {
    // OPTIONS (preflight CORS) se resuelve en el gateway; acá no debe caer en auth
    // (si no, devuelve 401 y el navegador bloquea el request real).
    if (c.req.method === "OPTIONS") return Promise.resolve(c.body(null, 204));
    if (c.req.method === "GET" && (c.req.path === "/companion" || c.req.path === "/media")) return next();
    return auth(c, next);
  });

  app.use("/admin/*", async (c, next) => {
    if (!isAdmin(c.get("sub"), c.get("groups"))) {
      return c.json({ error: "forbidden" }, 403);
    }
    await next();
  });

  app.get("/admin/whoami", (c) => c.json({ sub: c.get("sub"), isAdmin: true }));

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
  app.delete("/moods", async (c) => {
    const ts = c.req.query("ts");
    if (!ts) return c.json({ error: "ts is required" }, 400);
    await deps.moods.deleteMood(c.get("sub"), ts);
    return c.body(null, 204);
  });

  app.post("/tasks", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return c.json({ error: "text is required" }, 400);
    return c.json(await deps.tasks.createTask(c.get("sub"), text), 201);
  });
  app.patch("/tasks/:id", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const status = body.status;
    if (status !== "not_started" && status !== "in_progress" && status !== "completed") {
      return c.json({ error: "invalid status" }, 400);
    }
    const updated = await deps.tasks.updateTaskStatus(c.get("sub"), c.req.param("id"), status);
    return updated ? c.json(updated) : c.json({ error: "task not found" }, 404);
  });
  app.get("/tasks", async (c) => {
    const status = c.req.query("status");
    const valid = status === "not_started" || status === "in_progress" || status === "completed";
    return c.json({ tasks: await deps.tasks.listTasks(c.get("sub"), valid ? status : undefined) });
  });
  app.delete("/tasks/:id", async (c) => {
    await deps.tasks.deleteTask(c.get("sub"), c.req.param("id"));
    return c.body(null, 204);
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
  app.delete("/gratitudes", async (c) => {
    const ts = c.req.query("ts");
    if (!ts) return c.json({ error: "ts is required" }, 400);
    await deps.gratitudes.deleteGratitude(c.get("sub"), ts);
    return c.body(null, 204);
  });

  app.get("/me", async (c) => c.json(await deps.profile.getProfile(c.get("sub"))));
  app.put("/me", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const profile: Profile = {
      ...(typeof body.preferredSpecies === "string" ? { preferredSpecies: body.preferredSpecies } : {}),
      ...(typeof body.locale === "string" ? { locale: body.locale } : {}),
      ...(body.emergencyContact &&
      typeof body.emergencyContact.name === "string" &&
      typeof body.emergencyContact.phone === "string"
        ? { emergencyContact: { name: body.emergencyContact.name, phone: body.emergencyContact.phone } }
        : {}),
    };
    return c.json(await deps.profile.putProfile(c.get("sub"), profile));
  });

  app.get("/dashboard", async (c) => c.json(await deps.getDashboard(c.get("sub"))));

  app.get("/companion", async (c) => {
    const species = c.req.query("species") || "cat";
    if (!isSpecies(species) || !isSupported(species)) {
      return c.json({ error: "unsupported species" }, 400);
    }
    try {
      return c.json(await deps.getRandomAnimal(species));
    } catch {
      return c.json({ error: "could not fetch animal" }, 502);
    }
  });

  app.post("/companion/save", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { species, url } = body;
    if (typeof species !== "string" || typeof url !== "string") {
      return c.json({ error: "species and url are required" }, 400);
    }
    return c.json(await deps.saveAnimal(c.get("sub"), species, url), 201);
  });

  app.get("/companion/saved", async (c) => {
    return c.json({ saved: await deps.listSaved(c.get("sub")) });
  });

  app.get("/media", async (c) => {
    const kind = c.req.query("kind");
    return c.json({ media: await deps.listMedia(isMediaKind(kind ?? "") ? (kind as "sound" | "meditation") : undefined) });
  });
  app.post("/admin/media/upload-url", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!isMediaKind(body.kind) || typeof body.contentType !== "string") return c.json({ error: "kind and contentType required" }, 400);
    return c.json(await deps.createUploadUrl(body.kind, body.contentType));
  });
  app.post("/admin/media", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { id, name, kind, s3Key, contentType } = body;
    if (typeof id !== "string" || typeof name !== "string" || !isMediaKind(kind) || typeof s3Key !== "string" || typeof contentType !== "string")
      return c.json({ error: "invalid media" }, 400);
    await deps.confirmMedia({ id, name, kind, s3Key, contentType });
    return c.json({ ok: true }, 201);
  });
  app.delete("/admin/media/:kind/:id", async (c) => {
    const kind = c.req.param("kind");
    if (!isMediaKind(kind)) return c.json({ error: "invalid kind" }, 400);
    await deps.deleteMedia(kind, c.req.param("id"));
    return c.body(null, 204);
  });

  return app;
}
