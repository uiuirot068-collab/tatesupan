// Compares two layoutEquivalence snapshots (see layoutEquivalence.bench.ts).
// Usage: node scripts/perf/compareLayoutEquivalence.mjs <baseline.json> <candidate.json>
// Exit 0 only when both contain the same cases and every summary field and
// every product hash is identical.
import { readFileSync } from "node:fs";

const [baselinePath, candidatePath] = process.argv.slice(2);
if (!baselinePath || !candidatePath) {
  console.error("usage: compareLayoutEquivalence.mjs <baseline.json> <candidate.json>");
  process.exit(2);
}
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const candidate = JSON.parse(readFileSync(candidatePath, "utf8"));

const cases = [...new Set([...Object.keys(baseline), ...Object.keys(candidate)])].sort();
let failures = 0;
let hashCount = 0;
const speed = [];
for (const name of cases) {
  const before = baseline[name];
  const after = candidate[name];
  if (!before || !after) {
    console.log(`MISSING  ${name} (${before ? "candidate" : "baseline"} lacks it)`);
    failures++;
    continue;
  }
  const diffs = [];
  for (const [key, value] of Object.entries(before.summary)) {
    if (JSON.stringify(value) !== JSON.stringify(after.summary[key])) diffs.push(`summary.${key}: ${JSON.stringify(value)} -> ${JSON.stringify(after.summary[key])}`);
  }
  for (const [key, value] of Object.entries(before.hashes)) {
    hashCount++;
    if (value !== after.hashes[key]) diffs.push(`hashes.${key}: ${value} -> ${after.hashes[key]}`);
  }
  if (diffs.length > 0) {
    failures++;
    console.log(`DIFF     ${name}\n  ${diffs.join("\n  ")}`);
  } else {
    speed.push(`${name}: ${before.composeMs} -> ${after.composeMs} ms`);
  }
}
console.log(`\n${cases.length} cases, ${hashCount} product hashes compared, ${failures} case(s) differ.`);
if (process.env.SHOW_SPEED) console.log(speed.join("\n"));
process.exit(failures === 0 ? 0 : 1);
