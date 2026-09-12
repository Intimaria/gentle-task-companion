"use client";
import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
      if (u && !u.expired) setUser({ id: u.profile.sub, email: (u.profile.email ?? u.profile.preferred_username ?? u.profile["cognito:username"]) as string | undefined });
      setLoading(false);
    });
    const onLoaded = (u: User) => setUser({ id: u.profile.sub, email: (u.profile.email ?? u.profile.preferred_username ?? u.profile["cognito:username"]) as string | undefined });
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
