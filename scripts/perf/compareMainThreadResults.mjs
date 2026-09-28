// node scripts/perf/compareMainThreadResults.mjs <labelA> <labelB>
//
// Prints a before/after table of the per-action medians written by
// tests/e2e/mainThreadPreviewRequest.e2e.mjs
// (scripts/perf/results/browser-main-thread-<label>-<surface>-<fixture>.json).
import { existsSync, readFileSync } from "node:fs";

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error("usage: compareMainThreadResults.mjs <labelA> <labelB>");
  process.exit(2);
}
const load = (label, surface, fixture) => {
  const file = `scripts/perf/results/browser-main-thread-${label}-${surface}-${fixture}.json`;
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
};
const METRICS = [
  ["inputToRequestMs", "input→request"],
  ["inputToPaintedMs", "input→Preview painted"],
  ["longTaskMs", "long tasks in input→request"],
];
for (const surface of ["full", "windowed"]) {
  for (const fixture of ["normal", "longtail"]) {
    const before = load(a, surface, fixture);
    const after = load(b, surface, fixture);
    if (!before || !after) continue;
    console.log(`\n## ${surface.toUpperCase()} ${fixture} (${a} → ${b}, medians of ${after.repeat} runs)`);
    console.log(`action | ${METRICS.map(([, name]) => `${name} before | after | Δ`).join(" | ")}`);
    for (const action of Object.keys(after.results)) {
      const x = before.results[action]?.median;
      const y = after.results[action].median;
      if (!x) continue;
      const cells = METRICS.map(([key]) => `${x[key]} | ${y[key]} | ${y[key] - x[key] > 0 ? "+" : ""}${y[key] - x[key]}`);
      console.log(`${action} | ${cells.join(" | ")}`);
    }
  }
}
