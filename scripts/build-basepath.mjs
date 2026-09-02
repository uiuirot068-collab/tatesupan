// TSP-LOOP-013A/B — cross-platform "build for https://spuntales.net/tatespun/".
//
// 1. NEXT_PUBLIC_BASE_PATH (default "/tatespun" if not already set)
// 2. next build            → out/*            (flat, URLs prefixed /tatespun/…)
// 3. nest-export.mjs        → out/tatespun/*
// 4. write out/_redirects   → legacy-root 302  (AFTER nesting, at build root)
//
// Used locally and as the Cloudflare Pages `tatespun` project build command.
// The plain `npm run build` (root-served) path does NONE of steps 3–4.
//
//   npm run build:basepath
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

process.env.NEXT_PUBLIC_BASE_PATH =
  (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim() || "/tatespun";
const base = process.env.NEXT_PUBLIC_BASE_PATH.replace(/^\/+|\/+$/g, "");

console.log(`build:basepath — NEXT_PUBLIC_BASE_PATH=/${base}`);
execSync("next build", { stdio: "inherit", env: process.env });
execSync("node scripts/nest-export.mjs", { stdio: "inherit", env: process.env });

// Cloudflare Pages requires _redirects at the build-output ROOT (out/), i.e. a
// sibling of out/<base>/ — never inside it. It is written here, after nesting,
// so it cannot be swept into out/<base>/ by nest-export.
//
// Exactly one narrow rule: the bare legacy root → the new canonical path.
// NO catch-all (`/* /<base>/:splat`) — that would loop /<base>/… into
// /<base>/<base>/… on any 404 under the app.
const outDir = path.resolve("out");
const nested = path.join(outDir, base);
if (!fs.existsSync(nested)) {
  console.error(`build:basepath — out/${base}/ missing; nest-export did not complete.`);
  process.exit(1);
}
const redirectsPath = path.join(outDir, "_redirects");
fs.writeFileSync(redirectsPath, `/ /${base}/ 302\n`);
console.log(`build:basepath — wrote out/_redirects  ("/ /${base}/ 302")`);
