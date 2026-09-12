"use client";
import React, { useEffect } from "react";
import { userManager } from "../../../lib/oidc";

export default function AuthCallback() {
  useEffect(() => {
    userManager.signinRedirectCallback()
      .then(() => { window.location.replace("/"); })
      .catch(() => { window.location.replace("/"); });
  }, []);
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <span className="text-6xl" aria-hidden>🌸</span>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        <p className="text-white font-semibold text-lg tracking-wide">Iniciando sesión…</p>
      </div>
    </main>
  );
}
