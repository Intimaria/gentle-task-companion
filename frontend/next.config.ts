import type { NextConfig } from "next";

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

// AWS real: estático en S3+Cloudflare (NEXT_EXPORT=1 → out/). Container (self-host /
// AWS-emulado): sigue standalone para `next start`. Solo cambia el output, no el código.
// trailingSlash: true → exporta rutas como /auth/callback/index.html, que S3 website
// hosting resuelve como index document (sin él, /auth/callback da 404 → index.html).
const nextConfig: NextConfig = {
  output: process.env.NEXT_EXPORT ? "export" : "standalone",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default withPWA(nextConfig);
