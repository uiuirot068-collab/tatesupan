import { describe, expect, it } from "vitest";
import type { SourceBlock, SourceSpan } from "./span";

describe("SourceSpan shape", () => {
  it("holds a half-open code-point range against a blockId", () => {
    const span: SourceSpan = { blockId: "body-1", start: 0, end: 5 };
    expect(span.end).toBeGreaterThan(span.start);
  });

  it("supports a zero-width span at a candidate break boundary (Contract §8)", () => {
    const span: SourceSpan = { blockId: "body-1", start: 3, end: 3 };
    expect(span.end - span.start).toBe(0);
  });
});

describe("SourceBlock shape", () => {
  it("distinguishes BODY and COLOPHON block kinds (Contract §15)", () => {
    const body: SourceBlock = { blockId: "b1", kind: "BODY", normalizedText: "…" };
    const colophon: SourceBlock = { blockId: "c1", kind: "COLOPHON", normalizedText: "…" };
    expect(body.kind).not.toBe(colophon.kind);
  });
});
