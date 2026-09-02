// TSP-LOOP-013A — base path readiness gate.
//
// Verifies the app can be built for https://spuntales.net/tatespun/ without
// leaving root-relative refs that Next's basePath does not touch, and that the
// root (no-env) build is unaffected.
//
// Static source checks always run. If an `out/` build is present it is also
// checked structurally: pass `--build` to force a fresh basePath build first.
//
//   node scripts/verify-base-path.mjs [--build]
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => {
  const p = path.join(repoRoot, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
};

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}`);
  if (!cond) failures += 1;
}

const cfg = read("next.config.ts");
const helper = read("src/lib/basePath.ts");
const pkg = JSON.parse(read("package.json"));

/* ---------------- 1. config + helper ---------------- */

check(
  "1. next.config.ts derives basePath from NEXT_PUBLIC_BASE_PATH (one source of truth)",
  !!cfg &&
    /process\.env\.NEXT_PUBLIC_BASE_PATH/.test(cfg) &&
    /basePath/.test(cfg) &&
    /output:\s*"export"/.test(cfg) &&
    /unoptimized:\s*true/.test(cfg)
);
check(
  "1b. next.config.ts no longer hard-codes the GitHub-Actions '/tatesupan' assumption",
  !!cfg && !/tatesupan/.test(cfg) && !/GITHUB_ACTIONS/.test(cfg)
);
check(
  "1c. src/lib/basePath.ts exports BASE_PATH + withBasePath from the env var",
  !!helper &&
    /export const BASE_PATH = process\.env\.NEXT_PUBLIC_BASE_PATH/.test(helper) &&
    /export function withBasePath\(/.test(helper)
);
check(
  "1d. assetPrefix is not introduced (basePath alone handles same-origin _next)",
  !!cfg && !/assetPrefix/.test(cfg)
);

/* ---------------- 2. audited raw refs are wrapped ---------------- */

const cases = [
  ["Header.tsx logo", "src/components/Header.tsx", /withBasePath\('\/caroad_main2\.png'\)/],
  ["PageCard.tsx footer logo", "src/components/PageCard.tsx", /withBasePath\("\/caroad_main2\.png"\)/],
  ["page.tsx <Image> hero", "src/app/page.tsx", /withBasePath\("\/caroad_main1\.png"\)/],
  ["page.tsx <Image> logo light/dark", "src/app/page.tsx", /withBasePath\("\/caroad_main3\.png"\)/],
  ["Bookshelf.tsx rack svg", "src/components/bookshelf/Bookshelf.tsx", /withBasePath\(`\/assets\/bookshelf\/rack_/],
  ["BookSpine.tsx artwork fetch", "src/components/bookshelf/BookSpine.tsx", /withBasePath\(\s*isSample/],
  ["SpineStatusIcons cloud mask", "src/components/bookshelf/SpineStatusIcons.tsx", /--cloud-mask-url[\s\S]{0,40}withBasePath\("\/assets\/bookshelf\/icons\/cloud\.svg"\)/],
  ["HelpModal help.md fetch", "src/components/HelpModal.tsx", /fetch\(withBasePath\("\/docs\/help\.md"\)\)/],
  ["AuthModal reset redirectTo", "src/components/AuthModal.tsx", /\$\{window\.location\.origin\}\$\{BASE_PATH\}\/auth\/reset-password/],
];
for (const [label, file, re] of cases) {
  const src = read(file);
  check(`2. ${label} uses base-path helper`, !!src && re.test(src));
}

/* ---------------- 3. no un-wrapped root refs left ---------------- */

check(
  "3. every /caroad… and /assets/bookshelf/… literal sits inside a withBasePath(…) call",
  (() => {
    for (const f of [
      "src/components/Header.tsx",
      "src/components/PageCard.tsx",
      "src/app/page.tsx",
      "src/components/bookshelf/Bookshelf.tsx",
      "src/components/bookshelf/BookSpine.tsx",
      "src/components/bookshelf/SpineStatusIcons.tsx",
    ]) {
      const s = read(f) ?? "";
      const re = /["'`]\/(?:caroad_main\d|assets\/bookshelf\/)[^"'`]*["'`]/g;
      let m;
      while ((m = re.exec(s))) {
        // the literal must be an argument of a still-open withBasePath(...) call:
        // find the nearest preceding "withBasePath(" and confirm its parens are
        // not yet balanced/closed by the time we reach the literal.
        const window = s.slice(Math.max(0, m.index - 240), m.index);
        const call = window.lastIndexOf("withBasePath(");
        if (call === -1) return false;
        const between = window.slice(call + "withBasePath".length); // starts at "("
        let depth = 0;
        for (const ch of between) {
          if (ch === "(") depth += 1;
          else if (ch === ")") depth -= 1;
        }
        if (depth < 1) return false; // call already closed before the literal
      }
    }
    return true;
  })()
);
check(
  "3b. no bare fetch(\"/docs or fetch(\"/assets outside withBasePath",
  (() => {
    for (const f of ["src/components/HelpModal.tsx", "src/components/bookshelf/BookSpine.tsx"]) {
      const s = read(f) ?? "";
      if (/fetch\(\s*["'`]\/(docs|assets)/.test(s)) return false;
    }
    return true;
  })()
);
check(
  "3c. CSS mask uses the injected --cloud-mask-url custom property",
  (() => {
    const css = read("src/components/bookshelf/Bookshelf.module.css") ?? "";
    return /mask:\s*var\(--cloud-mask-url/.test(css);
  })()
);

/* ---------------- 4. canonical URL + build wiring ---------------- */

check(
  "4. PageCard footer shows the new canonical URL, not tatespun.pages.dev",
  (() => {
    const s = read("src/components/PageCard.tsx") ?? "";
    return /https:\/\/spuntales\.net\/tatespun\//.test(s) && !/tatespun\.pages\.dev/.test(s);
  })()
);
check(
  "4b. package.json has build:basepath; nest-export + build-basepath scripts exist",
  pkg.scripts["build:basepath"] === "node scripts/build-basepath.mjs" &&
    fs.existsSync(path.join(repoRoot, "scripts/nest-export.mjs")) &&
    fs.existsSync(path.join(repoRoot, "scripts/build-basepath.mjs"))
);
check(
  "4c. HelpModal no longer reads process.env.NEXT_PUBLIC_BASE_PATH directly (goes through the helper)",
  !/process\.env\.NEXT_PUBLIC_BASE_PATH/.test(read("src/components/HelpModal.tsx") ?? "x")
);

/* ---------------- 5. optional: structural check of a basePath build ---------------- */

const wantBuild = process.argv.includes("--build");
if (wantBuild) {
  console.log("… running `npm run build:basepath` for the structural check");
  execSync("npm run build:basepath", { cwd: repoRoot, stdio: "inherit" });
}
const outDir = path.join(repoRoot, "out");
const nested = path.join(outDir, "tatespun");
if (fs.existsSync(nested)) {
  const need = [
    "index.html",
    "editor.html",
    "privacy.html",
    "terms.html",
    "renderer-poc.html",
    "404.html",
    "auth/reset-password.html",
    "_next/static",
    "caroad_main1.png",
    "assets/bookshelf/rack_center.svg",
    "assets/bookshelf/icons/cloud.svg",
    "docs/help.md",
  ];
  check(
    "5. basePath build: every route + public asset present under out/tatespun/",
    need.every((n) => fs.existsSync(path.join(nested, n)))
  );
  check(
    "5b. basePath build: no bare root asset refs in the prerendered HTML",
    ["index.html", "editor.html", "privacy.html", "terms.html"].every((f) => {
      const html = fs.readFileSync(path.join(nested, f), "utf8");
      const bare = html.match(/(?:src|href)="\/(?:caroad|assets|docs|_next|icon)[^"]*"/g) || [];
      return bare.every((m) => m.includes('"/tatespun/'));
    })
  );
  check(
    "5c. basePath build: out/ contains ONLY the nested tatespun/ dir",
    fs.readdirSync(outDir).filter((n) => n !== ".gitkeep").join(",") === "tatespun"
  );
} else {
  console.log("SKIP: 5* structural build checks (no out/tatespun/ — pass --build or run `npm run build:basepath` first)");
}

/* ---------------- done ---------------- */

console.log("");
if (failures === 0) {
  console.log("All base-path checks passed.");
} else {
  console.log(`${failures} base-path check(s) FAILED.`);
  process.exit(1);
}
