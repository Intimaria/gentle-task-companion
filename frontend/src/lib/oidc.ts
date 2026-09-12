import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";

// Config OIDC portable (mock-oidc en dev; Authentik/Cognito en prod), por env NEXT_PUBLIC_*.
export const userManager = new UserManager({
  authority: process.env.NEXT_PUBLIC_OIDC_AUTHORITY!,
  // Cognito emulado: el `iss` es formato AWS pero la metadata se sirve en MiniStack
  // (split-horizon). Si NEXT_PUBLIC_OIDC_METADATA_URL está seteada, se usa para el fetch;
  // si no (self-host mock-oidc), oidc-client-ts la deriva del authority.
  metadataUrl: process.env.NEXT_PUBLIC_OIDC_METADATA_URL || undefined,
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
