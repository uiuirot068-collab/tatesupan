import type { NextConfig } from "next";

// TSP-LOOP-013A — one source of truth for the deploy base path.
// Set NEXT_PUBLIC_BASE_PATH="/tatespun" for the spuntales.net/tatespun/ build;
// leave it unset for root-served builds (local dev, current tatespun.pages.dev).
// src/lib/basePath.ts reads the same env var for manually constructed paths.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
