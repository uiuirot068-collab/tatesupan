import type { NextConfig } from "next";

// TSP-LOOP-013A — one source of truth for the deploy base path.
// Set NEXT_PUBLIC_BASE_PATH="/tatespun" for the spuntales.net/tatespun/ build;
// leave it unset for root-served builds (local dev, current tatespun.pages.dev).
// src/lib/basePath.ts reads the same env var for manually constructed paths.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

const nextConfig: NextConfig = {
  output: "export",
  // Human QA opens the local Editor through 127.0.0.1 as documented. Next
  // 16 otherwise serves the SSR shell but blocks every client/HMR asset as a
  // cross-origin dev request because `next dev` advertises localhost. The
  // unhydrated textarea appears editable while React state and 11-B stay at
  // zero. This option is development-only; it does not widen Production.
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    unoptimized: true,
  },
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
