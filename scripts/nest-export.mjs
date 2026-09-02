// TSP-LOOP-013A — nest the static export under its base path.
//
// `next build` with `output: "export"` + `basePath` writes URLs as
// `/tatespun/_next/...` INSIDE the HTML but still emits the files flat at
// `out/` root. A host that serves `out/` from the domain root (Cloudflare
// Pages) would then 404 every asset. This step relocates `out/*` → `out/<base>/`
// so `tatespun.pages.dev/tatespun/...` resolves 1:1 with the URLs in the HTML.
//
// No-op when NEXT_PUBLIC_BASE_PATH is empty (root build). Idempotent.
//
//   node scripts/nest-export.mjs
import fs from "node:fs";
import path from "node:path";

const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim().replace(/^\/+|\/+$/g, "");
const outDir = path.resolve("out");

if (!base) {
  console.log("nest-export: NEXT_PUBLIC_BASE_PATH empty — out/ left at root.");
  process.exit(0);
}
if (!fs.existsSync(outDir)) {
  console.error("nest-export: out/ not found — run `next build` first.");
  process.exit(1);
}
if (base.includes("..") || path.isAbsolute(base)) {
  console.error(`nest-export: refusing unsafe base path "${base}".`);
  process.exit(1);
}

const entries = fs.readdirSync(outDir);
if (entries.length === 1 && entries[0] === base) {
  console.log(`nest-export: out/${base}/ already nested — nothing to do.`);
  process.exit(0);
}

const tmp = path.join(path.dirname(outDir), `.nest-export-tmp-${process.pid}`);
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp);
for (const name of entries) {
  fs.renameSync(path.join(outDir, name), path.join(tmp, name));
}
fs.renameSync(tmp, path.join(outDir, base));
console.log(`nest-export: moved out/* → out/${base}/  (${entries.length} entries)`);
