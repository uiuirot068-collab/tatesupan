// TSP-LOOP-013A — cross-platform "build for https://spuntales.net/tatespun/".
//
// Sets NEXT_PUBLIC_BASE_PATH (default "/tatespun" if not already set), runs the
// normal static export, then nests out/ under the base path. Used locally and
// as the Cloudflare Pages `tatespun` project build command.
//
//   npm run build:basepath
import { execSync } from "node:child_process";

process.env.NEXT_PUBLIC_BASE_PATH =
  (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim() || "/tatespun";

console.log(`build:basepath — NEXT_PUBLIC_BASE_PATH=${process.env.NEXT_PUBLIC_BASE_PATH}`);
execSync("next build", { stdio: "inherit", env: process.env });
execSync("node scripts/nest-export.mjs", { stdio: "inherit", env: process.env });
