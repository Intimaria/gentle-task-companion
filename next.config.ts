import type { NextConfig } from "next";

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Optional: disables PWA in dev
});

module.exports = withPWA({
  
});
const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
