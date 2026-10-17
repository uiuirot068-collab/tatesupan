// TSP-IMPROVE-002 (P0-3): pure helpers for scripts/test-all.mjs.
// Kept free of process / child_process so tests/testAll.test.mjs can
// exercise the comparison against the known-failures list directly.
import path from "node:path";

// Vitest configs that `npm run test:all` must not run by default: they are
// benchmarks (slow, machine-dependent), not pass/fail tests.
export const EXCLUDED_CONFIGS = [
  "scripts/perf/vitest.config.ts",
  "tests/performance/vitest.config.ts",
];

export function toPosix(p) {
  return p.split(path.sep).join("/");
}

// One id per test: "<repo-relative file> > <describe> > ... > <test name>".
// A file that fails before any test runs (import error, syntax error)
// becomes "<file> > (file failed to load)".
export function failuresFromVitestJson(report, repoRoot) {
  const failures = [];
  let passed = 0;
  let skipped = 0;
  const passedIds = [];
  for (const file of report.testResults ?? []) {
    const rel = toPosix(path.relative(repoRoot, file.name));
    let failedHere = 0;
    for (const t of file.assertionResults ?? []) {
      const id = [rel, ...(t.ancestorTitles ?? []), t.title].join(" > ");
      if (t.status === "failed") {
        failures.push({ id, message: firstLine(t.failureMessages?.[0]) });
        failedHere++;
      } else if (t.status === "passed") {
        passed++;
        passedIds.push(id);
      } else {
        skipped++;
      }
    }
    if (file.status === "failed" && failedHere === 0) {
      failures.push({ id: `${rel} > (file failed to load)`, message: firstLine(file.message) });
    }
  }
  return { failures, passed, skipped, passedIds };
}

function firstLine(s) {
  if (!s) return "";
  return String(s).split("\n").find((l) => l.trim() !== "")?.trim().slice(0, 300) ?? "";
}

// Compare what failed now with the reviewed list in ci/known-failures.json.
//   unexpected: failed now, not on the list  -> the run fails
//   known:      failed now, on the list      -> allowed
//   fixed:      on the list, passed now      -> allowed, but the list is stale
//   notSeen:    on the list, neither failed nor passed (renamed / removed /
//               not run)                     -> allowed, but the list is stale
export function compareWithKnown(failedIds, passedIds, knownList) {
  const known = new Set(knownList.map((k) => k.id));
  const failed = new Set(failedIds);
  const passed = new Set(passedIds);
  const unexpected = [...failed].filter((id) => !known.has(id)).sort();
  const knownHit = [...failed].filter((id) => known.has(id)).sort();
  const fixed = [...known].filter((id) => !failed.has(id) && passed.has(id)).sort();
  const notSeen = [...known].filter((id) => !failed.has(id) && !passed.has(id)).sort();
  return { unexpected, known: knownHit, fixed, notSeen, ok: unexpected.length === 0 };
}
