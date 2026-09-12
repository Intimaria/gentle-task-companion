import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet, type JWK } from "jose";
import { createApp } from "../src/app";
import { createMood, listMoods, deleteMood } from "../src/data/moods";
import { createTask, listTasks, updateTaskStatus, deleteTask } from "../src/data/tasks";
import { createGratitude, listGratitudes, deleteGratitude } from "../src/data/gratitudes";
import { getProfile, putProfile } from "../src/data/profile";
import { getDashboard } from "../src/data/dashboard";
import type { AnimalImage } from "../src/data/companion";
import type { SavedAnimal } from "../src/data/storage";
import type { MediaItem } from "../src/data/media";

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
  const fakeGetRandomAnimal = async (s: string): Promise<AnimalImage> => ({
    species: s as AnimalImage["species"],
    url: "http://x/img.jpg",
  });
  const fakeSavedAnimal: SavedAnimal = { id: "fav1", species: "cat", savedAt: "2026-08-05T00:00:00.000Z", url: "http://x/fav.jpg" };
  const fakeMediaItem: MediaItem = { id: "m1", name: "Rain", kind: "sound", url: "http://x/rain" };
  app = createApp({
    auth: { jwks, issuer: ISSUER, audience: AUDIENCE },
    moods: { createMood, listMoods, deleteMood },
    tasks: { createTask, listTasks, updateTaskStatus, deleteTask },
    gratitudes: { createGratitude, listGratitudes, deleteGratitude },
    profile: { getProfile, putProfile },
    getDashboard,
    getRandomAnimal: fakeGetRandomAnimal,
    saveAnimal: async () => ({ id: "fav1" }),
    listSaved: async () => [fakeSavedAnimal],
    listMedia: async () => [fakeMediaItem],
    createUploadUrl: async () => ({ id: "m1", s3Key: "media/sound/m1", putUrl: "http://x/put" }),
    confirmMedia: async () => {},
    deleteMedia: async () => {},
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

describe("domain API", () => {
  it("creates and lists tasks", async () => {
    const token = await sign(`dom-tasks-${Math.floor(performance.now() * 1000)}`);
    const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const post = await app.request("/tasks", { method: "POST", headers: h, body: JSON.stringify({ text: "respirar" }) });
    expect(post.status).toBe(201);
    const { id } = await post.json();
    const patch = await app.request(`/tasks/${id}`, { method: "PATCH", headers: h, body: JSON.stringify({ status: "completed" }) });
    expect(patch.status).toBe(200);
    const get = await app.request("/tasks?status=completed", { headers: h });
    expect((await get.json()).tasks).toHaveLength(1);
  });

  it("rejects an empty task", async () => {
    const token = await sign(`dom-empty-${Math.floor(performance.now() * 1000)}`);
    const res = await app.request("/tasks", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ text: "" }) });
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

describe("companion API", () => {
  it("GET /companion?species=cat returns 200 with a url WITHOUT any Authorization header (public route)", async () => {
    const res = await app.request("/companion?species=cat");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBeDefined();
  });

  it("GET /companion?species=bird returns 400 (no API key configured)", async () => {
    const res = await app.request("/companion?species=bird");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("unsupported species");
  });

  it("GET /companion defaults to cat when species is omitted", async () => {
    const res = await app.request("/companion");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.species).toBe("cat");
  });

  it("GET /companion?species=frog returns 400 for unknown species", async () => {
    const res = await app.request("/companion?species=frog");
    expect(res.status).toBe(400);
  });

  it("POST /companion/save WITHOUT token → 401", async () => {
    const res = await app.request("/companion/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ species: "cat", url: "http://x/c.jpg" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /companion/save WITH token → 201 with id", async () => {
    const token = await sign("save-test-user");
    const res = await app.request("/companion/save", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ species: "cat", url: "http://x/c.jpg" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
  });

  it("GET /companion/saved WITHOUT token → 401", async () => {
    const res = await app.request("/companion/saved");
    expect(res.status).toBe(401);
  });

  it("GET /companion/saved WITH token → 200 with saved array", async () => {
    const token = await sign("saved-test-user");
    const res = await app.request("/companion/saved", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.saved)).toBe(true);
  });
});

describe("media API", () => {
  it("GET /media returns 200 with media array WITHOUT any token (public route)", async () => {
    const res = await app.request("/media");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.media)).toBe(true);
    expect(body.media[0].id).toBe("m1");
    expect(body.media[0].name).toBe("Rain");
    expect(body.media[0].kind).toBe("sound");
  });

  it("GET /media?kind=sound returns 200 with filtered media WITHOUT any token", async () => {
    const res = await app.request("/media?kind=sound");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.media)).toBe(true);
  });
});
