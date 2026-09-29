// node scripts/perf/compareSurfaceParity.mjs <full.json> <windowed.json>
//
// Diffs two runs of tests/e2e/editorSurfaceParity.e2e.mjs (one per editor
// surface) scenario by scenario: SAME, DIFFERENT (with both values), or a
// scenario missing / errored on one side. A difference is data for the
// parity audit (docs/TATESPUN_FULL_WINDOWED_PARITY_AUDIT.md), not a failure:
// the exit code is 0 unless a file is missing or a scenario errored.
import { readFileSync } from "node:fs";

const [fullFile, windowedFile] = process.argv.slice(2);
if (!fullFile || !windowedFile) {
  console.error("usage: compareSurfaceParity.mjs <full.json> <windowed.json>");
  process.exit(2);
}
const full = JSON.parse(readFileSync(fullFile, "utf8"));
const windowed = JSON.parse(readFileSync(windowedFile, "utf8"));

let errors = 0;
let same = 0;
const names = [...new Set([...Object.keys(full.scenarios), ...Object.keys(windowed.scenarios)])];
for (const name of names) {
  const a = full.scenarios[name];
  const b = windowed.scenarios[name];
  if (!a || !b || a.error || b.error) {
    errors++;
    console.log(`ERROR     ${name}: FULL ${JSON.stringify(a)} | WINDOWED ${JSON.stringify(b)}`);
    continue;
  }
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const differing = keys.filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]));
  if (differing.length === 0) {
    same++;
    console.log(`SAME      ${name}`);
  } else {
    console.log(`DIFFERENT ${name}: ${differing.map((key) => `${key} FULL=${JSON.stringify(a[key])} WINDOWED=${JSON.stringify(b[key])}`).join("; ")}`);
  }
}
console.log(`${same}/${names.length} scenarios identical (${full.surface} vs ${windowed.surface}); ${errors} errored`);
process.exit(errors ? 1 : 0);
