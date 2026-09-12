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

let signWithGroups: (sub: string, groups: string[]) => Promise<string>;
let signPlain: (sub: string) => Promise<string>;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = (await exportJWK(publicKey)) as JWK;
  jwk.kid = "admin-key";
  const jwks = createLocalJWKSet({ keys: [jwk] });

  signWithGroups = (sub: string, groups: string[]) =>
    new SignJWT({ groups })
      .setProtectedHeader({ alg: "RS256", kid: "admin-key" })
      .setSubject(sub)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime("1h")
      .sign(privateKey);

  signPlain = (sub: string) =>
    new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "admin-key" })
      .setSubject(sub)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime("1h")
      .sign(privateKey);

  const fakeGetRandomAnimal = async (s: string): Promise<AnimalImage> => ({
    species: s as AnimalImage["species"],
    url: "http://x/img.jpg",
  });
  const fakeSavedAnimal: SavedAnimal = {
    id: "fav1",
    species: "cat",
    savedAt: "2026-08-05T00:00:00.000Z",
    url: "http://x/fav.jpg",
  };

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

describe("RBAC — /admin/whoami", () => {
  it("returns 401 when no token is provided", async () => {
    const res = await app.request("/admin/whoami");
    expect(res.status).toBe(401);
  });

  it("returns 403 when token has no admin group", async () => {
    const token = await signPlain("regular-user");
    const res = await app.request("/admin/whoami", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("returns 403 when token has a non-admin group", async () => {
    const token = await signWithGroups("regular-user", ["users", "editors"]);
    const res = await app.request("/admin/whoami", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 with isAdmin true when token has groups: [admin]", async () => {
    const token = await signWithGroups("admin-user", ["admin"]);
    const res = await app.request("/admin/whoami", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isAdmin).toBe(true);
    expect(body.sub).toBe("admin-user");
  });

  it("returns 200 when token has admin among multiple groups", async () => {
    const token = await signWithGroups("multi-group-user", ["users", "admin", "moderators"]);
    const res = await app.request("/admin/whoami", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isAdmin).toBe(true);
  });
});

describe("RBAC — groups claim in context", () => {
  it("exposes groups from JWT payload via the auth middleware", async () => {
    // We test this indirectly: admin guard reads groups from context.
    // A token with groups:["admin"] reaches /admin/whoami (200), proving
    // createAuth sets groups in context correctly.
    const token = await signWithGroups("ctx-test", ["admin"]);
    const res = await app.request("/admin/whoami", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });
});

describe("RBAC — ADMIN_SUBS env fallback", () => {
  it("allows a sub listed in ADMIN_SUBS even without groups claim", async () => {
    const originalAdminSubs = process.env.ADMIN_SUBS;
    process.env.ADMIN_SUBS = "env-admin-user";
    try {
      const token = await signPlain("env-admin-user");
      const res = await app.request("/admin/whoami", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isAdmin).toBe(true);
    } finally {
      if (originalAdminSubs === undefined) {
        delete process.env.ADMIN_SUBS;
      } else {
        process.env.ADMIN_SUBS = originalAdminSubs;
      }
    }
  });

  it("does NOT allow a sub not in ADMIN_SUBS when no groups", async () => {
    const originalAdminSubs = process.env.ADMIN_SUBS;
    process.env.ADMIN_SUBS = "other-admin";
    try {
      const token = await signPlain("not-admin-user");
      const res = await app.request("/admin/whoami", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(403);
    } finally {
      if (originalAdminSubs === undefined) {
        delete process.env.ADMIN_SUBS;
      } else {
        process.env.ADMIN_SUBS = originalAdminSubs;
      }
    }
  });
});

describe("media admin — POST /admin/media/upload-url", () => {
  it("returns 401 when no token is provided", async () => {
    const res = await app.request("/admin/media/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "sound", contentType: "audio/mpeg" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when token has no admin group", async () => {
    const token = await signPlain("regular-user");
    const res = await app.request("/admin/media/upload-url", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "sound", contentType: "audio/mpeg" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 with id, s3Key, putUrl when admin", async () => {
    const token = await signWithGroups("admin-user", ["admin"]);
    const res = await app.request("/admin/media/upload-url", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "sound", contentType: "audio/mpeg" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.id).toBe("string");
    expect(typeof body.s3Key).toBe("string");
    expect(typeof body.putUrl).toBe("string");
  });

  it("returns 400 when kind is invalid", async () => {
    const token = await signWithGroups("admin-user", ["admin"]);
    const res = await app.request("/admin/media/upload-url", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "invalid", contentType: "audio/mpeg" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("media admin — POST /admin/media (confirm)", () => {
  it("returns 403 when token has no admin group", async () => {
    const token = await signPlain("regular-user");
    const res = await app.request("/admin/media", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: "m1", name: "Rain", kind: "sound", s3Key: "media/sound/m1", contentType: "audio/mpeg" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 201 when admin confirms media", async () => {
    const token = await signWithGroups("admin-user", ["admin"]);
    const res = await app.request("/admin/media", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: "m1", name: "Rain", kind: "sound", s3Key: "media/sound/m1", contentType: "audio/mpeg" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe("media admin — DELETE /admin/media/:kind/:id", () => {
  it("returns 403 when token has no admin group", async () => {
    const token = await signPlain("regular-user");
    const res = await app.request("/admin/media/sound/m1", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("returns 204 when admin deletes media", async () => {
    const token = await signWithGroups("admin-user", ["admin"]);
    const res = await app.request("/admin/media/sound/m1", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(204);
  });

  it("returns 400 when kind is invalid", async () => {
    const token = await signWithGroups("admin-user", ["admin"]);
    const res = await app.request("/admin/media/invalid/m1", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(400);
  });
});
