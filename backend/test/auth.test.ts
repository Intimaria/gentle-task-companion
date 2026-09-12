import { describe, it, expect, beforeAll } from "vitest";
import { Hono } from "hono";
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet, type JWK } from "jose";
import { createAuth } from "../src/auth/oidc";
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
let app: Hono;

// Full app instance (needed for /admin/whoami and /me routes)
let fullApp: ReturnType<typeof createApp>;

// Helper: sign with arbitrary extra claims, optionally omitting aud
let signCustom: (
  sub: string,
  extra: Record<string, unknown>,
  opts?: { omitAud?: boolean; clientId?: string }
) => Promise<string>;

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

  signCustom = (sub, extra, opts = {}) => {
    const builder = new SignJWT({ ...extra, ...(opts.clientId ? { client_id: opts.clientId } : {}) })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setSubject(sub)
      .setIssuer(ISSUER)
      .setExpirationTime("1h");
    if (!opts.omitAud) builder.setAudience(AUDIENCE);
    return builder.sign(privateKey);
  };

  app = new Hono();
  app.use("*", createAuth({ jwks, issuer: ISSUER, audience: AUDIENCE }));
  app.get("/whoami", (c) => c.json({ sub: c.get("sub") }));

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

  fullApp = createApp({
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

describe("Cognito compat — cognito:groups claim", () => {
  it("treats cognito:groups as the groups claim for RBAC (admin route 200)", async () => {
    // Cognito puts groups under the 'cognito:groups' key, not 'groups'.
    // The middleware must pick it up so the admin guard sees the admin group.
    const token = await signCustom("cognito-admin", { "cognito:groups": ["admin"] });
    const res = await fullApp.request("/admin/whoami", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isAdmin).toBe(true);
  });
});

describe("Cognito compat — client_id as audience (access token, no aud)", () => {
  it("accepts a token without aud when client_id matches the configured audience", async () => {
    // Cognito access tokens have no `aud`; they carry `client_id` instead.
    // Auth should pass (not 401) when client_id === configured audience.
    const token = await signCustom("cognito-user", {}, { omitAud: true, clientId: AUDIENCE });
    const res = await app.request("/whoami", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).not.toBe(401);
  });
});
