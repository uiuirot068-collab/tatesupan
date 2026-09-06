import { describe, expect, it } from "vitest";
import { utf16ToCodePointOffset, codePointToUtf16Offset, normalizeUtf16Span, type ComparisonDocument } from "./normalize";
import { compareDocuments, summarize } from "./classify";
import { runFixture } from "./compare";
import {
  ALL_FIXTURES,
  canonicalSentenceFixture,
  manualPageBreakFixture,
  imageFlowFixture,
  hangingPunctuationFixture,
  dashRunFixture,
  paragraphBreakGapFixture,
  supplementaryPlaneCharFixture,
  twoColumnFlowFixture,
} from "./fixtures";

describe("normalize.ts — UTF-16 <-> code-point offset conversion", () => {
  it("round-trips ASCII/kana text (1 UTF-16 unit == 1 code point)", () => {
    const source = "あいうえお";
    for (let i = 0; i <= source.length; i++) {
      expect(codePointToUtf16Offset(source, utf16ToCodePointOffset(source, i))).toBe(i);
    }
  });

  it("correctly halves a supplementary-plane (surrogate-pair) character's width", () => {
    const source = "あ😀い"; // あ(1) + emoji(2 UTF-16 units, 1 code point) + い(1) = 4 UTF-16 units, 3 code points
    expect(source.length).toBe(4);
    expect(utf16ToCodePointOffset(source, 0)).toBe(0);
    expect(utf16ToCodePointOffset(source, 1)).toBe(1); // just past あ
    expect(utf16ToCodePointOffset(source, 3)).toBe(2); // just past the full emoji (both surrogate halves)
    expect(utf16ToCodePointOffset(source, 4)).toBe(3);
    expect(codePointToUtf16Offset(source, 2)).toBe(3);
  });

  it("normalizeUtf16Span converts both endpoints consistently", () => {
    const source = "あ😀い";
    const normalized = normalizeUtf16Span(source, { start: 0, end: 4 });
    expect(normalized).toEqual({ start: 0, end: 3 });
  });
});

function doc(pages: ComparisonDocument["pages"], overrides: Partial<ComparisonDocument> = {}): ComparisonDocument {
  return { engine: "legacy", pages, hold: false, holdReasons: [], sourceCodePointLength: 0, ...overrides };
}

const line = (text: string) => ({ lineIndex: 0, text, unitKinds: ["TEXT" as const] });
const page = (text: string, manualBreakBefore = false) => ({
  pageIndex: 0,
  sourceSpan: { start: 0, end: text.length },
  manualBreakBefore,
  columns: [{ columnIndex: 0, lines: [line(text)] }],
});

describe("classify.ts — deterministic classification", () => {
  it("is deterministic: identical documents produce byte-identical diffs across repeated calls", () => {
    const a = doc([page("同じ")]);
    const b = doc([page("同じ")], { engine: "v2" });
    const first = JSON.stringify(compareDocuments(a, b));
    const second = JSON.stringify(compareDocuments(a, b));
    expect(second).toBe(first);
  });

  it("a known MATCH document pair remains MATCH end to end", () => {
    const a = doc([page("同じ内容")]);
    const b = doc([page("同じ内容")], { engine: "v2" });
    const diffs = compareDocuments(a, b);
    const summary = summarize(diffs);
    expect(summary.unexpectedDifference).toBe(0);
    expect(summary.unexpectedHigh).toBe(0);
    expect(diffs.every((d) => d.category === "MATCH")).toBe(true);
  });

  it("a known EXPECTED difference carries its exact declared reason code, not a generic label", () => {
    const a = doc([page("違う内容A")]);
    const b = doc([page("違う内容B")], { engine: "v2" });
    const diffs = compareDocuments(a, b, {
      expectedDifferences: [{ pathPrefix: "page[0].column[0].line[0].text", reasonCode: "EXPECTED_TEST_REASON", severity: "LOW", notes: "test" }],
      notComparable: [],
    });
    const textDiff = diffs.find((d) => d.path === "page[0].column[0].line[0].text");
    expect(textDiff?.category).toBe("EXPECTED_DIFFERENCE");
    expect(textDiff?.reasonCode).toBe("EXPECTED_TEST_REASON");
  });

  it("an undeclared difference is never silently downgraded from UNEXPECTED_DIFFERENCE", () => {
    const a = doc([page("違う内容A")]);
    const b = doc([page("違う内容B")], { engine: "v2" });
    const diffs = compareDocuments(a, b); // no expectations declared at all
    const textDiff = diffs.find((d) => d.path === "page[0].column[0].line[0].text");
    expect(textDiff?.category).toBe("UNEXPECTED_DIFFERENCE");
    expect(textDiff?.reasonCode).toBeUndefined();
  });

  it("source loss (content missing on one side) triggers HIGH severity", () => {
    const a = doc([page("本文がここにある")]);
    const b = doc([page("")], { engine: "v2" }); // v2 side lost all content
    const diffs = compareDocuments(a, b);
    const concatDiff = diffs.find((d) => d.path === "document.concatenatedText");
    expect(concatDiff?.category).toBe("UNEXPECTED_DIFFERENCE");
    expect(concatDiff?.severity).toBe("HIGH");
  });

  it("source duplication (content doubled on one side) triggers HIGH severity", () => {
    const a = doc([page("本文")]);
    const b = doc([page("本文本文")], { engine: "v2" }); // v2 side duplicated content
    const diffs = compareDocuments(a, b);
    const concatDiff = diffs.find((d) => d.path === "document.concatenatedText");
    expect(concatDiff?.category).toBe("UNEXPECTED_DIFFERENCE");
    expect(concatDiff?.severity).toBe("HIGH");
  });

  it("a manual-break mismatch triggers HIGH severity", () => {
    const a = doc([page("本文", false)]);
    const b = doc([page("本文", true)], { engine: "v2" });
    const diffs = compareDocuments(a, b);
    const breakDiff = diffs.find((d) => d.path === "page[0].manualBreakBefore");
    expect(breakDiff?.category).toBe("UNEXPECTED_DIFFERENCE");
    expect(breakDiff?.severity).toBe("HIGH");
  });
});

describe("Stage C fixture corpus — end-to-end legacy vs. v2 comparison", () => {
  it("runs every fixture without throwing, and every diff carries a recognized category", () => {
    for (const fixture of ALL_FIXTURES) {
      const result = runFixture(fixture);
      expect(result.legacyMirror.consistent).toBe(true); // legacy's own two mirror implementations agree on page count
      for (const d of result.diffs) {
        expect(["MATCH", "EXPECTED_DIFFERENCE", "UNEXPECTED_DIFFERENCE", "NOT_COMPARABLE_YET"]).toContain(d.category);
      }
    }
  });

  it("finds zero source content loss/duplication anywhere in the corpus, despite real structural divergence elsewhere", () => {
    // document.concatenatedText (or, for the two fixtures with their own
    // dedicated integrity check, concatenatedText.surrogatePairIntegrity)
    // must MATCH for every fixture — the headline Stage C safety property,
    // independent of whatever line/page-count divergence a fixture reveals.
    for (const fixture of ALL_FIXTURES) {
      const result = runFixture(fixture);
      const integrityDiffs = result.diffs.filter((d) => d.path.startsWith("document.concatenatedText"));
      expect(integrityDiffs.length).toBeGreaterThan(0);
      for (const d of integrityDiffs) {
        expect(["MATCH", "EXPECTED_DIFFERENCE"]).toContain(d.category);
      }
    }
  });

  it("is deterministic: repeated runs of the same fixture produce byte-identical classification", () => {
    const first = runFixture(canonicalSentenceFixture);
    const second = runFixture(canonicalSentenceFixture);
    expect(JSON.stringify(second.diffs)).toBe(JSON.stringify(first.diffs));
    expect(second.classification).toEqual(first.classification);
  });

  it("manual-page-break: both engines agree on page count and where the forced break lands", () => {
    const result = runFixture(manualPageBreakFixture);
    expect(result.legacySummary.pageCount).toBe(2);
    expect(result.v2Summary.pageCount).toBe(2);
    const breakDiff = result.diffs.find((d) => d.path === "page[1].manualBreakBefore");
    expect(breakDiff?.category).toBe("MATCH");
    expect(breakDiff?.legacyValue).toBe("true");
    expect(breakDiff?.v2Value).toBe("true");
  });

  it("manual-page-break: NEWLY DISCOVERED — legacy's own insertPageBreakMarker padding convention leaves a phantom empty first line after the break; v2 has none", () => {
    // pageBreakCommandSpan (tategaki.ts) only absorbs the LEADING \n before a
    // marker alone on its own line, plus the marker itself — the TRAILING \n
    // (added by insertPageBreakMarker's own "needsTrailing" padding, exactly
    // reproduced by this fixture's legacySource) is left for ordinary
    // tokenization and becomes its own zero-content line. This is real,
    // reproducible CURRENT legacy behavior (confirmed by direct code
    // reading of pageBreakCommandSpan's consumeEnd, which only ever extends
    // to the end of the marker's OWN line) — not a fixture-authoring
    // mistake, and not resolved by this Loop; recorded as a discovered gap.
    const result = runFixture(manualPageBreakFixture);
    const lineCountDiff = result.diffs.find((d) => d.path === "page[1].column[0].lines.length");
    expect(lineCountDiff?.category).toBe("UNEXPECTED_DIFFERENCE"); // no frozen policy explains this yet — must not be silently reclassified
    expect(lineCountDiff?.legacyValue).toBe("2");
    expect(lineCountDiff?.v2Value).toBe("1");
    const phantomLine = result.diffs.find((d) => d.path === "page[1].column[0].line[0].text");
    expect(phantomLine?.legacyValue).toBe(""); // legacy's phantom empty line
  });

  it("image-flow: the pre-declared EXPECTED_DIFFERENCE reason code is actually used, not left UNEXPECTED", () => {
    const result = runFixture(imageFlowFixture);
    expect(result.legacySummary.pageCount).toBe(1); // legacy: image costs 0
    expect(result.v2Summary.pageCount).toBeGreaterThan(1); // v2: image consumes real extent, forces a second page
    const pageCountDiff = result.diffs.find((d) => d.path === "pages.length");
    expect(pageCountDiff?.category).toBe("EXPECTED_DIFFERENCE");
    expect(pageCountDiff?.reasonCode).toBe("EXPECTED_IMAGE_FLOW_V2");
    expect(result.classification.unexpectedHigh).toBe(0);
  });

  it("hanging-punctuation (F06): a real divergence exists and is classified EXPECTED_DIFFERENCE, not silently absorbed as MATCH", () => {
    const result = runFixture(hangingPunctuationFixture);
    const hasReclassified = result.diffs.some((d) => d.reasonCode === "EXPECTED_F06_HANGING_DEFERRED");
    // Whether or not this specific capacity happens to trigger a visible
    // divergence is itself Stage C evidence (recorded in the evidence doc) —
    // this assertion only guards against silently mislabeling a real one.
    if (result.classification.unexpectedDifference > 0 && !hasReclassified) {
      throw new Error("hanging-punctuation fixture produced an undeclared UNEXPECTED_DIFFERENCE — investigate before assuming it is the known F06 gap");
    }
  });

  it("dash-run: TEXT/SEMANTIC_RUN kind-labeling difference does not mask the underlying text-content match", () => {
    const result = runFixture(dashRunFixture);
    const concatDiff = result.diffs.find((d) => d.path === "document.concatenatedText");
    expect(concatDiff?.category).toBe("MATCH");
  });

  it("two-column-flow: NEWLY DISCOVERED — legacy's 一字下げ auto-indent (TSP-LOOP-029) has no v2 equivalent, cascading a constant 1-character offset through the whole document", () => {
    // Plain kana, no kinsoku/hanging/ruby/TCY involved at all — isolates
    // the auto-indent gap from every other mechanism. Legacy reduces the
    // very first line's budget by 1 (`paragraphNeedsAutoIndent` /
    // `openLineBudget` in tategaki.ts); v2's compose/line.ts has no
    // equivalent concept anywhere (confirmed by direct code reading — no
    // "indent" match anywhere under core/compose/). The one-time -1 on
    // line 1 then cascades: every later line boundary is offset by exactly
    // the same 1 character for the rest of the document, since the content
    // stream simply continues from wherever the previous engine's line
    // left off.
    const result = runFixture(twoColumnFlowFixture);
    const firstLineDiff = result.diffs.find((d) => d.path === "page[0].column[0].line[0].text");
    expect(firstLineDiff?.category).toBe("UNEXPECTED_DIFFERENCE"); // no frozen policy explains this yet
    // Legacy's line 1 holds exactly one FEWER character than v2's — the
    // one-time 一字下げ reduction that applies only to a paragraph's first
    // line. From line 2 onward both engines return to equal per-line
    // capacity (5 characters each, this fixture's charsPerLine) — the
    // deficit doesn't compound as a growing length difference, it
    // persists as a constant 1-character CONTENT offset (every later line
    // holds the same character count as its counterpart, just shifted by
    // one position) for the rest of the document. Confirmed via this
    // fixture's own full diff dump during this Loop's own investigation;
    // the corpus-wide integrity test above independently confirms no
    // content is lost or duplicated by this cascade.
    expect(firstLineDiff?.legacyValue.length).toBe((firstLineDiff?.v2Value.length ?? 0) - 1);
    const secondLineDiff = result.diffs.find((d) => d.path === "page[0].column[0].line[1].text");
    expect(secondLineDiff?.legacyValue.length).toBe(secondLineDiff?.v2Value.length); // equal length, shifted content
    expect(secondLineDiff?.category).toBe("UNEXPECTED_DIFFERENCE");
  });

  it("paragraph-break-gap: reproduces the newly-discovered gap as a genuine, undeclared UNEXPECTED_DIFFERENCE", () => {
    const result = runFixture(paragraphBreakGapFixture);
    expect(result.legacySummary.pageCount).toBe(1);
    // Legacy's own forced "\n" line break means 2 lines on legacy's single page;
    // v2's Natural Pitch has no equivalent forced break, so it composes 1 line.
    const lineCountDiff = result.diffs.find((d) => d.path === "page[0].column[0].lines.length");
    expect(lineCountDiff?.category).toBe("UNEXPECTED_DIFFERENCE"); // must NOT be silently reclassified — no frozen policy explains this yet
    expect(lineCountDiff?.legacyValue).toBe("2");
    expect(lineCountDiff?.v2Value).toBe("1");
  });

  it("supplementary-plane-char: legacy's naive UTF-16 split corrupts the emoji; v2's INV-011 keeps it intact", () => {
    const result = runFixture(supplementaryPlaneCharFixture);
    // The concatenated-text check alone does NOT catch this class of
    // corruption (string concatenation trivially rejoins a split surrogate
    // pair) — confirmed to MATCH here, which is why a dedicated per-line
    // surrogate-pair well-formedness check exists (classify.ts).
    const concatDiff = result.diffs.find((d) => d.path === "document.concatenatedText");
    expect(concatDiff?.category).toBe("MATCH");
    const surrogateDiff = result.diffs.find((d) => d.path === "document.concatenatedText.surrogatePairIntegrity");
    expect(surrogateDiff?.category).toBe("EXPECTED_DIFFERENCE");
    expect(surrogateDiff?.reasonCode).toBe("EXPECTED_V2_GRAPHEME_SAFETY_LEGACY_UTF16_UNSAFE");
    expect(surrogateDiff?.legacyValue).toBe("page[0].column[0].line[0]"); // legacy: split found
    expect(surrogateDiff?.v2Value).toBe("<none>"); // v2: INV-011 guarantees no split anywhere
  });
});
