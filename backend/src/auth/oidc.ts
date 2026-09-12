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
      // Cognito: el access token no trae `aud` (trae `client_id`); el id token sí trae aud.
      // Validamos issuer siempre; audience solo si el token la trae.
      const { payload } = await jwtVerify(match[1], config.jwks, {
        issuer: config.issuer,
      });
      const aud = payload.aud;
      const audOk = aud
        ? (Array.isArray(aud) ? aud.includes(config.audience) : aud === config.audience)
        : payload.client_id === config.audience;
      if (!audOk) return c.json({ error: "invalid audience" }, 401);
      if (!payload.sub) return c.json({ error: "token has no sub" }, 401);
      const groups = payload.groups ?? payload["cognito:groups"];
      c.set("sub", payload.sub);
      c.set("groups", Array.isArray(groups) ? (groups as string[]) : []);
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
