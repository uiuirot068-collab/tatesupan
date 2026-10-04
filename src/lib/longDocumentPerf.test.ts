import { describe, expect, it } from "vitest";
import {
  buildLongDocumentFixture,
  createLongDocumentPerfStore,
  getLongDocumentPerfSummary,
  isLongDocumentPerfEnabled,
  LONG_DOCUMENT_FIXTURE_TARGETS,
  LONG_DOCUMENT_PERF_MAX_SAMPLES,
  longDocumentEditOffset,
  measureLongDocumentPerf,
  pushLongDocumentPerfSample,
  recordLongDocumentPerf,
  summarizeLongDocumentPerf,
  type LongDocumentPerfSample,
} from "./longDocumentPerf";

const sample = (metric: LongDocumentPerfSample["metric"], ms: number): LongDocumentPerfSample => ({
  metric,
  ms,
  chars: 100,
  at: 0,
});

describe("CST-PORT-016 long-document perf: summary", () => {
  it("count / avg / p95 / max per metric", () => {
    const samples = Array.from({ length: 20 }, (_, i) => sample("inputToNextFrame", i + 1));
    samples.push(sample("previewCompose", 40), sample("previewCompose", 10));
    const summary = summarizeLongDocumentPerf(samples);
    expect(summary.inputToNextFrame).toEqual({ count: 20, avgMs: 10.5, p95Ms: 19, maxMs: 20 });
    expect(summary.previewCompose).toEqual({ count: 2, avgMs: 25, p95Ms: 40, maxMs: 40 });
    expect(summary.editorPagination).toBeUndefined();
  });

  it("empty → no rows", () => {
    expect(summarizeLongDocumentPerf([])).toEqual({});
  });

  it("keeps only the newest samples", () => {
    const store = createLongDocumentPerfStore();
    for (let i = 0; i < LONG_DOCUMENT_PERF_MAX_SAMPLES + 5; i += 1) pushLongDocumentPerfSample(store, sample("inputToNextFrame", i));
    expect(store.samples).toHaveLength(LONG_DOCUMENT_PERF_MAX_SAMPLES);
    expect(store.samples[0].ms).toBe(5);
    store.clear();
    expect(store.summary()).toEqual({});
  });
});

describe("CST-PORT-016 long-document perf: off unless ?perf=1", () => {
  it("is a no-op without a browser URL", () => {
    expect(isLongDocumentPerfEnabled()).toBe(false);
    recordLongDocumentPerf({ metric: "inputToNextFrame", ms: 1, chars: 1 });
    expect(getLongDocumentPerfSummary()).toEqual({});
    let calls = 0;
    expect(measureLongDocumentPerf("editorPagination", 3, () => (calls += 1, "ok"))).toBe("ok");
    expect(calls).toBe(1);
  });
});

describe("CST-PORT-016 long-document perf: fixtures", () => {
  it("builds exactly the requested length, deterministically", () => {
    for (const target of LONG_DOCUMENT_FIXTURE_TARGETS) {
      for (const kind of ["plain", "ruby", "structure"] as const) {
        const text = buildLongDocumentFixture(target, kind);
        expect(text).toHaveLength(target);
        expect(buildLongDocumentFixture(target, kind)).toBe(text);
      }
    }
  });

  it("uses TateSpun notation (ruby, 縦中横, 改ページ)", () => {
    expect(buildLongDocumentFixture(1000, "ruby")).toContain("｜長文《ちょうぶん》");
    expect(buildLongDocumentFixture(1000, "ruby")).toContain("[tate]A5[/tate]");
    expect(buildLongDocumentFixture(1000, "structure")).toContain("【改ページ】");
  });

  it("edit offsets: after the first char, the middle, before the last char", () => {
    expect(longDocumentEditOffset(100, "start")).toBe(1);
    expect(longDocumentEditOffset(100, "middle")).toBe(50);
    expect(longDocumentEditOffset(100, "end")).toBe(99);
    expect(longDocumentEditOffset(0, "start")).toBe(0);
    expect(longDocumentEditOffset(0, "end")).toBe(0);
  });
});
