/**
 * Phase 7 diagnosis: CPU-profile target for export PaintPlan construction.
 * Run: TATESPUN_PERF_EXPORT_PROFILE=1 npx vitest run --config scripts/perf/vitest.config.ts exportProfile \
 *        --pool=forks --poolOptions.forks.execArgv=--cpu-prof --poolOptions.forks.execArgv=--cpu-prof-dir=<dir>
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Session } from "node:inspector/promises";
import { it } from "vitest";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/pageLayout";
import { composeV2Layout } from "@/lib/v2Bridge/composeV2Document";
import { createShipporiMinchoMeasurementProvider } from "../../typesetting-v2/core/measurement/shipporiMinchoProvider";
import { buildPublicationPaintPlan } from "../../typesetting-v2/renderer/publication/pdfGenerator";
import { syntheticManuscript } from "./longManuscript.bench";

const run = process.env.TATESPUN_PERF_EXPORT_PROFILE === "1" ? it : it.skip;

run("export plan profile target (20 pages)", async () => {
  const session = new Session();
  session.connect();
  await session.post("Profiler.enable");
  const measurement = createShipporiMinchoMeasurementProvider(resolve("public/fonts/ShipporiMincho-Regular.ttf"));
  const layout = composeV2Layout({ title: "Bench", content: syntheticManuscript(20), settings: DEFAULT_PAGE_SETTINGS, measurement });
  const base64 = readFileSync(resolve("public/fonts/ShipporiMincho-Regular.ttf")).toString("base64");
  await session.post("Profiler.start");
  const start = performance.now();
  buildPublicationPaintPlan(layout.model, { fileName: "f.ttf", fontName: "Shippori Mincho", base64 }, layout.pageGeometry, "profile");
  console.log(`export plan 20p: ${Math.round(performance.now() - start)}ms`);
  const { profile } = await session.post("Profiler.stop");
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map<string, number>();
  profile.samples!.forEach((id, i) => {
    const f = byId.get(id)!.callFrame;
    const key = `${f.functionName} ${f.url.split("/").slice(-1)[0]}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (profile.timeDeltas![i] ?? 0));
  });
  for (const [key, us] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`${(us / 1000).toFixed(0).padStart(6)}ms ${key}`);
});
