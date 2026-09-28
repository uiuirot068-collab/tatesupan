/**
 * Main-thread keystroke-path benchmark (NOT part of any test suite; never
 * asserts timings). Times, in Node, every whole-manuscript helper that runs
 * on the main thread between an editor input and the V2 compose request, on
 * the same 300k-character fixtures as tests/e2e/mainThreadPreviewRequest.e2e.mjs.
 * Methodology/results: docs/TATESPUN_MAIN_THREAD_PREVIEW_PERFORMANCE.md.
 *
 * Run: TATESPUN_PERF_KEYSTROKE=1 npx vitest run --config scripts/perf/vitest.config.ts keystrokePath
 * Env: TATESPUN_PERF_LABEL (results/<label>-keystroke-path.json).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { it } from "vitest";
import { referencedImageSignature } from "@/lib/cloudImageSync";
import { resolveTextareaDeletion } from "@/lib/editorInputIntegrity";
import { applyTextInputChange, captureBeforeInput, createTextInputActivityState } from "@/lib/editorSessionActivity/model";
import { countVisualLength, imageMarkerIds } from "@/lib/tategaki";
import { DEFAULT_ENABLED_RULE_IDS, runWritingCheck } from "@/lib/writingCheckEngine/engine";
import type { WritingRuleId } from "@/lib/writingCheckEngine/types";
import { referencedImages } from "@/lib/v2Bridge/previewWorkerClient";

const run = process.env.TATESPUN_PERF_KEYSTROKE === "1" ? it : it.skip;
const LABEL = process.env.TATESPUN_PERF_LABEL ?? "local";

const SENTENCES = [
  "春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。",
  "彼女は古い手紙を読み返し、ふと遠い町のことを思い出す。",
  "「もう一度だけ、あの坂を上ってみようか」と彼は言った。",
  "雨上がりの路地には、濡れた石畳の匂いが満ちている。",
  "時計の針は止まったまま、部屋の隅で静かに眠っていた。",
];
function prose(length: number, seed = 0): string {
  let text = "";
  for (let i = seed; text.length < length; i++) text += SENTENCES[i % SENTENCES.length];
  return text.slice(0, length);
}
function manuscript(longParagraph: number): string {
  const text = prose(300_000 - longParagraph);
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += 150) parts.push("　" + text.slice(i, i + 150));
  if (longParagraph) parts.push("　" + prose(longParagraph, 2));
  return parts.join("\n");
}

/** Median of `repeat` runs, after one warm-up. */
function time(fn: () => unknown, repeat = 7): number {
  fn();
  const samples: number[] = [];
  for (let i = 0; i < repeat; i++) {
    const started = performance.now();
    fn();
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  return Math.round(samples[Math.floor(repeat / 2)] * 100) / 100;
}

run("keystroke-path helpers on 300k-character manuscripts", () => {
  const report: Record<string, Record<string, number>> = {};
  for (const [name, text] of [["normal", manuscript(0)], ["longtail", manuscript(20_000)]] as const) {
    const edited = text.slice(0, text.length >> 1) + "あ" + text.slice(text.length >> 1);
    const row: Record<string, number> = {};
    for (const ruleId of Object.keys(DEFAULT_ENABLED_RULE_IDS) as WritingRuleId[]) {
      if (!DEFAULT_ENABLED_RULE_IDS[ruleId]) continue;
      row[`writingCheck:${ruleId}`] = time(() => runWritingCheck(text, { enabledRuleIds: [ruleId] }));
    }
    row["writingCheck:all-default"] = time(() => runWritingCheck(text));
    row.countVisualLength = time(() => countVisualLength(text));
    row.referencedImageSignature = time(() => referencedImageSignature(text));
    row.imageMarkerIds = time(() => imageMarkerIds(text));
    row["referencedImages(workerPayload)"] = time(() => referencedImages({}, text));
    // The textarea deletion guard (EditorPane/PagedEditor onChange) for one Backspace / Delete.
    const backspaceAtEnd = { beforeText: text, selectionStart: text.length, selectionEnd: text.length, inputType: "deleteContentBackward" };
    row["resolveTextareaDeletion(Backspace, end)"] = time(() => resolveTextareaDeletion(backspaceAtEnd, text.slice(0, -1)));
    const deleteInMiddle = { beforeText: text, selectionStart: text.length >> 1, selectionEnd: text.length >> 1, inputType: "deleteContentForward" };
    row["resolveTextareaDeletion(Delete, middle)"] = time(() => resolveTextareaDeletion(deleteInMiddle, text.slice(0, text.length >> 1) + text.slice((text.length >> 1) + 1)));
    const activity = createTextInputActivityState(text);
    // The browser path: beforeinput captured the operand (typing, Enter, Backspace, IME commit).
    const middle = text.length >> 1;
    const withBeforeInput = captureBeforeInput(activity, { beforeText: text, selectionStart: middle, selectionEnd: middle, inputType: "insertText" });
    row["applyTextInputChange(insertText)"] = time(() => applyTextInputChange(withBeforeInput, edited));
    // Fallback only (no beforeinput captured): whole-text code-point diff.
    row["applyTextInputChange(no beforeinput)"] = time(() => applyTextInputChange(activity, edited));
    report[name] = row;
    console.log(`${name} (${text.length} chars)`);
    for (const [key, ms] of Object.entries(row)) console.log(`  ${key.padEnd(34)} ${ms.toFixed(2)} ms`);
  }
  const outDir = resolve("scripts/perf/results");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, `${LABEL}-keystroke-path.json`), JSON.stringify(report, null, 2) + "\n");
});
