import { describe, it, expect } from "vitest";
import { createAppFromEnv } from "../src/appFactory";

describe("createAppFromEnv", () => {
  it("arma un Hono con las rutas públicas montadas", async () => {
    process.env.OIDC_ISSUER = "https://issuer.test";
    process.env.OIDC_JWKS_URI = "https://issuer.test/jwks";
    process.env.OIDC_AUDIENCE = "gentle";
    const app = createAppFromEnv();
    // /companion sin species válida → 400 (ruta pública montada, no 404)
    const res = await app.request("/companion?species=nope");
    expect(res.status).toBe(400);
  });
});
