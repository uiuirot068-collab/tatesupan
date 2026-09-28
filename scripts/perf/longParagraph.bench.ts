/**
 * Core long-paragraph benchmark (NOT part of any test suite; never asserts
 * timings). Measures `composeV2Layout` for single-paragraph manuscripts of
 * growing length against paragraph-split controls of the same length, and
 * (optionally) records an inspector CPU profile to name the hot functions.
 * Methodology/results: docs/TATESPUN_CORE_LONG_PARAGRAPH_PERFORMANCE.md.
 *
 * Run: TATESPUN_PERF_LONG_PARAGRAPH=1 npx vitest run --config scripts/perf/vitest.config.ts longParagraph
 * Env: TATESPUN_PERF_LABEL (results/<label>-long-paragraph.json),
 *      TATESPUN_PERF_LP_SIZES=5000,10000,20000 (single-paragraph lengths),
 *      TATESPUN_PERF_LP_PROFILE=1 (top self-time functions per single case),
 *      TATESPUN_PERF_LP_300K=0 to skip the 300k-character cases.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Session, type Profiler } from "node:inspector";
import { resolve } from "node:path";
import { it } from "vitest";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/pageLayout";
import { composeV2Layout } from "@/lib/v2Bridge/composeV2Document";
import { createShipporiMinchoMeasurementProvider } from "../../typesetting-v2/core/measurement/shipporiMinchoProvider";

const run = process.env.TATESPUN_PERF_LONG_PARAGRAPH === "1" ? it : it.skip;
const SIZES = (process.env.TATESPUN_PERF_LP_SIZES ?? "5000,10000,20000").split(",").map(Number);
const PROFILE = process.env.TATESPUN_PERF_LP_PROFILE === "1";
const WITH_300K = process.env.TATESPUN_PERF_LP_300K !== "0";

const SENTENCES = [
  "春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。",
  "彼女は古い手紙を読み返し、ふと遠い町のことを思い出す。",
  "「もう一度だけ、あの坂を上ってみようか」と彼は言った。",
  "雨上がりの路地には、濡れた石畳の匂いが満ちている。",
  "時計の針は止まったまま、部屋の隅で静かに眠っていた。",
];

/** Deterministic prose of exactly `length` characters (UTF-16 == code points here). */
export function prose(length: number, seed = 0): string {
  let text = "";
  for (let i = seed; text.length < length; i++) text += SENTENCES[i % SENTENCES.length];
  return text.slice(0, length);
}

/** One paragraph: indent + `length` characters, no newline. */
export function singleParagraph(length: number): string {
  return "　" + prose(length);
}

/** The same characters split into ~150-character paragraphs. */
export function splitParagraphs(length: number, every = 150): string {
  const text = prose(length);
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += every) parts.push("　" + text.slice(i, i + every));
  return parts.join("\n");
}

/** ~300k characters of ordinary paragraphs, optionally with one long paragraph in the middle. */
export function representative300k(longParagraph = 0): string {
  const normal = splitParagraphs(300_000 - longParagraph);
  if (longParagraph === 0) return normal;
  const middle = normal.indexOf("\n", normal.length >> 1);
  return `${normal.slice(0, middle)}\n　${prose(longParagraph, 2)}${normal.slice(middle)}`;
}

function post<T>(session: Session, method: string, params?: object): Promise<T> {
  return new Promise((resolvePost, reject) => session.post(method, params ?? {}, (error, result) => (error ? reject(error) : resolvePost(result as T))));
}

function topSelf(profile: Profiler.Profile, limit = 12): { fn: string; ms: number; share: number }[] {
  const self = new Map<number, number>();
  profile.samples!.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas![i] ?? 0)));
  const byName = new Map<string, number>();
  let total = 0;
  for (const node of profile.nodes) {
    const us = self.get(node.id) ?? 0;
    total += us;
    const file = node.callFrame.url.split(/[\\/]/).pop() ?? "";
    const key = `${node.callFrame.functionName || "(anonymous)"} ${file}:${node.callFrame.lineNumber + 1}`;
    byName.set(key, (byName.get(key) ?? 0) + us);
  }
  return Array.from(byName, ([fn, us]) => ({ fn, ms: Math.round(us / 100) / 10, share: Math.round((us / total) * 1000) / 10 }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, limit);
}

/**
 * Operation counts for one compose: how many times a string was expanded to a
 * code-point array (`Array.from(string)`) and how many code points that
 * produced in total. A layout that re-expands a paragraph per line/boundary
 * shows code points ≫ characters (quadratic); a linear one stays a small
 * multiple of the manuscript length.
 */
export function countStringMaterialization(fn: () => void): { arrayFromStringCalls: number; codePointsMaterialized: number } {
  const original = Array.from;
  let calls = 0;
  let codePoints = 0;
  (Array as { from: unknown }).from = function patched(this: unknown, ...args: unknown[]) {
    const result = (original as (...a: unknown[]) => unknown[]).apply(this, args);
    if (typeof args[0] === "string") {
      calls++;
      codePoints += result.length;
    }
    return result;
  };
  try {
    fn();
  } finally {
    (Array as { from: unknown }).from = original;
  }
  return { arrayFromStringCalls: calls, codePointsMaterialized: codePoints };
}

run("core long paragraph benchmark", async () => {
  const measurement = createShipporiMinchoMeasurementProvider(resolve("public/fonts/ShipporiMincho-Regular.ttf"));
  const compose = (content: string) => composeV2Layout({ title: "Bench", content, settings: DEFAULT_PAGE_SETTINGS, measurement });
  const session = new Session();
  session.connect();
  await post(session, "Profiler.enable");
  await post(session, "Profiler.setSamplingInterval", { interval: 500 });

  const cases: { name: string; content: string; profile: boolean }[] = [];
  for (const size of SIZES) {
    cases.push({ name: `single-${size}`, content: singleParagraph(size), profile: PROFILE });
    cases.push({ name: `split-${size}`, content: splitParagraphs(size), profile: false });
  }
  if (WITH_300K) {
    cases.push({ name: "300k-normal", content: representative300k(0), profile: PROFILE });
    cases.push({ name: "300k-with-20k-paragraph", content: representative300k(20_000), profile: false });
  }

  compose(splitParagraphs(2000)); // warm-up (JIT, font tables)
  const rows: Record<string, unknown>[] = [];
  for (const { name, content, profile } of cases) {
    if (profile) await post(session, "Profiler.start");
    const started = performance.now();
    const layout = compose(content);
    const ms = Math.round((performance.now() - started) * 10) / 10;
    const lines = layout.document.pages.reduce((n, page) => n + page.columns.reduce((m, column) => m + column.lines.length, 0), 0);
    const counts = countStringMaterialization(() => compose(content));
    const row: Record<string, unknown> = { name, chars: content.length, ms, pages: layout.document.pages.length, lines, units: layout.units.length, ...counts };
    if (profile) row.topSelf = topSelf((await post<{ profile: Profiler.Profile }>(session, "Profiler.stop")).profile);
    rows.push(row);
    console.log(JSON.stringify(row, null, profile ? 1 : 0));
  }
  session.disconnect();

  const label = process.env.TATESPUN_PERF_LABEL ?? "local";
  mkdirSync("scripts/perf/results", { recursive: true });
  writeFileSync(`scripts/perf/results/${label}-long-paragraph.json`, JSON.stringify({ label, node: process.version, rows }, null, 2) + "\n");
});
