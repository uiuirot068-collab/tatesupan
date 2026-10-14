#!/usr/bin/env node
// TSP-IMPROVE-002 (P0-3): run every test in the repo in one go.
//
//   npm run test:all            run all vitest configs + node --test files
//   npm run test:all -- --list  only print which configs would run
//
// `npm test` (root vitest.config.ts) covers only a fifth of the tests. This
// script finds every vitest config in the repo (except the benchmark ones,
// see EXCLUDED_CONFIGS), runs each one, collects the failures and compares
// them with ci/known-failures.json. Only failures that are NOT on that
// reviewed list make the run fail. Known failures that now pass are printed
// so the list can be trimmed. See docs/TEST_FAILURES.md.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXCLUDED_CONFIGS,
  compareWithKnown,
  failuresFromVitestJson,
  toPosix,
} from "./test-all-lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "build", ".git", "coverage"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out);
    } else {
      out.push(toPosix(path.relative(repoRoot, path.join(dir, entry.name))));
    }
  }
  return out;
}

const allFiles = walk(repoRoot);
const configs = allFiles
  .filter((f) => /(^|\/)vitest(\.[\w-]+)?\.config\.ts$/.test(f))
  .filter((f) => !EXCLUDED_CONFIGS.includes(f))
  .sort();
const nodeTests = allFiles.filter((f) => /^tests\/[^/]+\.test\.mjs$/.test(f)).sort();

if (process.argv.includes("--list")) {
  console.log(configs.join("\n"));
  console.log(nodeTests.map((f) => `node --test ${f}`).join("\n"));
  process.exit(0);
}

const knownPath = path.join(repoRoot, "ci/known-failures.json");
const knownList = JSON.parse(fs.readFileSync(knownPath, "utf8")).failures;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tatespun-test-all-"));
const failures = new Map();
const passedIds = new Set();
const ranFiles = new Set();
const brokenConfigs = [];
let passed = 0;
let skipped = 0;

for (const [i, config] of configs.entries()) {
  const out = path.join(tmp, `${i}.json`);
  process.stdout.write(`[${i + 1}/${configs.length}] ${config} ... `);
  const res = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "node_modules/vitest/vitest.mjs"),
      "run",
      "--config", config,
      "--reporter=json",
      "--outputFile", out,
    ],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  if (!fs.existsSync(out)) {
    console.log("could not run");
    brokenConfigs.push({ config, output: (res.stderr || res.stdout || "").slice(-2000) });
    continue;
  }
  const report = JSON.parse(fs.readFileSync(out, "utf8"));
  for (const file of report.testResults ?? []) ranFiles.add(toPosix(path.relative(repoRoot, file.name)));
  const r = failuresFromVitestJson(report, repoRoot);
  for (const f of r.failures) failures.set(f.id, f);
  for (const id of r.passedIds) passedIds.add(id);
  passed += r.passed;
  skipped += r.skipped;
  console.log(`${r.passed} passed, ${r.failures.length} failed`);
}

for (const file of nodeTests) {
  process.stdout.write(`node --test ${file} ... `);
  const res = spawnSync(process.execPath, ["--test", file], { cwd: repoRoot, encoding: "utf8" });
  const id = `${file} > (node --test)`;
  if (res.status === 0) {
    passed++;
    passedIds.add(id);
    console.log("ok");
  } else {
    failures.set(id, { id, message: (res.stdout || "").split("\n").find((l) => l.startsWith("not ok")) ?? "" });
    console.log("FAILED");
  }
  ranFiles.add(file);
}
fs.rmSync(tmp, { recursive: true, force: true });

const result = compareWithKnown([...failures.keys()], [...passedIds], knownList);
const notCovered = allFiles
  .filter((f) => /\.test\.(ts|tsx)$/.test(f) && !/\.benchmark\.test\.ts$/.test(f) && !f.startsWith("tests/e2e/"))
  .filter((f) => !ranFiles.has(f));

console.log("");
console.log(`passed ${passed}, failed ${failures.size} (known ${result.known.length}, new ${result.unexpected.length}), skipped ${skipped}`);
if (result.fixed.length) {
  console.log(`\nOn ci/known-failures.json but passing now (${result.fixed.length}) - remove them from the list:`);
  for (const id of result.fixed) console.log(`  ${id}`);
}
if (result.notSeen.length) {
  console.log(`\nOn ci/known-failures.json but not run at all (${result.notSeen.length}) - renamed or deleted?`);
  for (const id of result.notSeen) console.log(`  ${id}`);
}
if (notCovered.length) {
  console.log(`\nTest files no vitest config picks up (${notCovered.length}):`);
  for (const f of notCovered) console.log(`  ${f}`);
}
if (result.unexpected.length) {
  console.log(`\nNEW failures, not on ci/known-failures.json (${result.unexpected.length}):`);
  for (const id of result.unexpected) console.log(`  ${id}\n      ${failures.get(id).message}`);
}
if (brokenConfigs.length) {
  console.log(`\nConfigs that could not run (${brokenConfigs.length}):`);
  for (const b of brokenConfigs) console.log(`  ${b.config}\n${b.output}`);
}
const ok = result.ok && brokenConfigs.length === 0;
console.log(ok ? "\ntest:all OK" : "\ntest:all FAILED");
process.exit(ok ? 0 : 1);
