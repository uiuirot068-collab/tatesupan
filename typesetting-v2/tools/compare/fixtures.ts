// Stage C — fixture corpus (CORE_MIGRATION_ROLLBACK_PLAN.md §2 "one
// manuscript + LayoutSettings" through each engine). Each fixture is a
// hand-authored (legacy raw text, v2 LogicalUnit[]) pair — see
// `fixtureBuilder.ts`'s module comment for why. Track C1 only
// (capacity-equalized) — Track C2 (product-behavior) is documentary in
// `qa/evidence/STAGE_C_LOGICAL_COMPARISON.md` §7, not executed by this file
// (see that document for why: avoiding `src/lib/pageLayout.ts`'s `@/*`
// alias-resolution risk for a comparison this Loop can already source from
// existing P3-O12/Editor-Inventory evidence).
//
// PRE-DECLARED expectations are asserted BEFORE running anything, from
// direct source reading (not after seeing a surprising result) — see each
// fixture's own comment for the citation. Fixtures with no prior
// documented reason to expect a divergence carry NO_EXPECTATIONS
// deliberately, so this harness's own output — not this file's authors'
// assumptions — is the evidence for MATCH/UNEXPECTED_DIFFERENCE.

import type { Fixture } from "./compare";
import { NO_EXPECTATIONS, type FixtureExpectations } from "./classify";
import { buildFixtureUnits } from "./fixtureBuilder";

const BLOCK = "body";

function expect(rules: FixtureExpectations["expectedDifferences"]): FixtureExpectations {
  return { expectedDifferences: rules, notComparable: [] };
}

// F20 — canonical regression sentence (Master §0 motivation,
// REGRESSION_CORPUS_SPEC.md §1, verbatim from
// `composeCanonicalDocument.test.ts`'s own F20 fixture).
const CANONICAL_SENTENCE =
  "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」";

export const canonicalSentenceFixture: Fixture = (() => {
  const { units, source } = buildFixtureUnits(BLOCK, [{ kind: "TEXT", text: CANONICAL_SENTENCE }]);
  return {
    id: "canonical-regression-sentence",
    description: "F20 canonical regression sentence — mandatory per this Loop's brief.",
    legacySource: CANONICAL_SENTENCE,
    v2BodyUnits: units,
    v2Source: source,
    capacity: { charsPerLine: 12, linesPerColumn: 6, columnCount: 1, bodyFontSizePt: 10 },
    expectations: NO_EXPECTATIONS,
  };
})();

// Long, non-repeating Human QA prose — `prototypes/ui-comparison/shared/content.js`
// `MANUSCRIPT_TEXT`, approved for Human QA use per
// `qa/research/PREVIEW_DEVELOPMENT_ADAPTER_PLAN.md` §0 Decision 4. Copied
// verbatim (not the shared file itself, per that decision's own instruction
// to extend a COPY, not the shared original) — includes a dash run and two
// "\n\n" paragraph boundaries, so it independently exercises the
// paragraph-break gap (see `paragraphBreakGapFixture` below) at realistic
// prose scale, not just in isolation.
const LONG_PROSE =
  "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」\n\n" +
  "窓の外では雨が降り続いていた。傘を持たずに出てきたことを、今更ながら少し悔やんだ。それでも歩調を緩める気にはならなかった。" +
  "駅までの道のりは、いつもよりずっと長く感じられた。\n\n" +
  "――それでも、まだ引き返す理由にはならない。";

export const longProseFixture: Fixture = (() => {
  const { units, source } = buildFixtureUnits(BLOCK, [{ kind: "TEXT", text: LONG_PROSE }]);
  return {
    id: "long-non-repeating-prose",
    description: "prototypes/ui-comparison MANUSCRIPT_TEXT — long, non-repeating Human QA fixture, multi-page.",
    legacySource: LONG_PROSE,
    v2BodyUnits: units,
    v2Source: source,
    capacity: { charsPerLine: 15, linesPerColumn: 4, columnCount: 1, bodyFontSizePt: 10 },
    expectations: NO_EXPECTATIONS, // observe raw: this fixture's own "\n\n" boundaries are expected to surface the paragraph-break gap on their own merits
  };
})();

export const baselineKanaFixture: Fixture = (() => {
  const text = "あいうえおかきくけこさしすせそたちつてとなにぬねの";
  const { units, source } = buildFixtureUnits(BLOCK, [{ kind: "TEXT", text }]);
  return {
    id: "baseline-ascii-kana",
    description: "Plain kana, no punctuation — simplest possible multi-page/no-kinsoku baseline.",
    legacySource: text,
    v2BodyUnits: units,
    v2Source: source,
    capacity: { charsPerLine: 5, linesPerColumn: 3, columnCount: 1, bodyFontSizePt: 10 },
    expectations: NO_EXPECTATIONS,
  };
})();

export const kinsokuLineStartFixture: Fixture = (() => {
  const text = "これはテストです」と彼は静かに言った";
  const { units, source } = buildFixtureUnits(BLOCK, [{ kind: "TEXT", text }]);
  return {
    id: "kinsoku-line-start",
    description: "行頭禁則: naive break would land right before a closing bracket 」.",
    legacySource: text,
    v2BodyUnits: units,
    v2Source: source,
    capacity: { charsPerLine: 8, linesPerColumn: 4, columnCount: 1, bodyFontSizePt: 10 },
    expectations: NO_EXPECTATIONS,
  };
})();

export const kinsokuLineEndFixture: Fixture = (() => {
  const text = "すると「静かな声が聞こえた気がした";
  const { units, source } = buildFixtureUnits(BLOCK, [{ kind: "TEXT", text }]);
  return {
    id: "kinsoku-line-end",
    description: "行末禁則: naive break would land right after an opening bracket 「.",
    legacySource: text,
    v2BodyUnits: units,
    v2Source: source,
    capacity: { charsPerLine: 4, linesPerColumn: 5, columnCount: 1, bodyFontSizePt: 10 },
    expectations: NO_EXPECTATIONS,
  };
})();

// HIGH priority per this Loop's brief: manual page break. Marker-adjacent
// newlines are deliberately absorbed into the marker's own consumed span
// (`pageBreakCommandSpan`, `insertPageBreakMarker`'s own padding rule) —
// this fixture is built via that exact helper so it never accidentally
// conflates the manual-break comparison with the separately-tested
// paragraph-break-newline gap.
export const manualPageBreakFixture: Fixture = (() => {
  const before = "第一章";
  const after = "第二章の本文です";
  const legacySource = `${before}\n【改ページ】\n${after}`;
  const { units, source } = buildFixtureUnits(BLOCK, [
    { kind: "TEXT", text: before },
    { kind: "MANUAL_BREAK" },
    { kind: "TEXT", text: after },
  ]);
  return {
    id: "manual-page-break",
    description: "【改ページ】 forces a page break regardless of remaining capacity (Contract §13/INV-006).",
    legacySource,
    v2BodyUnits: units,
    v2Source: source,
    capacity: { charsPerLine: 10, linesPerColumn: 5, columnCount: 1, bodyFontSizePt: 10 },
    expectations: NO_EXPECTATIONS,
  };
})();

export const twoColumnFlowFixture: Fixture = (() => {
  const text = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわ";
  const { units, source } = buildFixtureUnits(BLOCK, [{ kind: "TEXT", text }]);
  return {
    id: "two-column-flow",
    description: "Plain kana, columnCount=2 — column transition + independent per-column residual.",
    legacySource: text,
    v2BodyUnits: units,
    v2Source: source,
    capacity: { charsPerLine: 5, linesPerColumn: 3, columnCount: 2, bodyFontSizePt: 10 },
    expectations: NO_EXPECTATIONS,
  };
})();

export const atomicRubyFixture: Fixture = (() => {
  const legacySource = "｜東京《とうきょう》に行く用事があった";
  const { units, source } = buildFixtureUnits(BLOCK, [
    { kind: "RUBY", base: "東京", reading: "とうきょう", rubyKind: "ATOMIC" },
    { kind: "TEXT", text: "に行く用事があった" },
  ]);
  return {
    id: "atomic-ruby",
    description: "Ordinary ruby, explicit ｜base《reading》 notation — base treated as one atomic group.",
    legacySource,
    v2BodyUnits: units,
    v2Source: source,
    capacity: { charsPerLine: 10, linesPerColumn: 5, columnCount: 1, bodyFontSizePt: 10 },
    expectations: NO_EXPECTATIONS,
  };
})();

// HG-3 capability check: legacy has NO concept of an internally-breakable
// jukugo-ruby group at all (ruby is always one atomic token regardless of
// notation, `tategaki.ts`'s RUBY_PATTERN captures one base+one reading with
// no internal segmentation) — so legacy's encoding of a jukugo word is
// identical in shape to ordinary atomic ruby. This fixture keeps capacity
// comfortable (no forced split) so the comparable claim is narrow and
// honest: BOTH engines keep the group intact under normal capacity: v2's
// distinct capability to legally split it at a declared segment boundary
// under capacity pressure is already covered by `core/ruby/index.test.ts`
// (P3-L11) and is not re-proven here under artificial pressure, given this
// Loop's own timebox — recorded as a scoping decision in the evidence doc,
// not a silent omission.
export const jukugoRubyFixture: Fixture = (() => {
  const legacySource = "｜小春日和《こはるびより》の一日";
  const { units, source } = buildFixtureUnits(BLOCK, [
    {
      kind: "RUBY_JUKUGO",
      segments: [
        { base: "小春", reading: "こはる" },
        { base: "日和", reading: "びより" },
      ],
    },
    { kind: "TEXT", text: "の一日" },
  ]);
  return {
    id: "jukugo-ruby-declared-segments",
    description: "Jukugo ruby with declared segments — comfortable capacity, no forced internal split (see scoping note above).",
    legacySource,
    v2BodyUnits: units,
    v2Source: source,
    capacity: { charsPerLine: 12, linesPerColumn: 5, columnCount: 1, bodyFontSizePt: 10 },
    expectations: NO_EXPECTATIONS,
  };
})();

export const explicitTcyFixture: Fixture = (() => {
  const legacySource = "その日は西暦[tate]2026[/tate]年だった";
  const { units, source } = buildFixtureUnits(BLOCK, [
    { kind: "TEXT", text: "その日は西暦" },
    { kind: "TCY", text: "2026", logicalCells: 1 }, // logicalCells=1 matches legacy's OWN fixed-1-cell tokenLength rule for TCY, a deliberate Track C1 normalization (see STAGE_C_LOGICAL_COMPARISON.md §9)
    { kind: "TEXT", text: "年だった" },
  ]);
  return {
    id: "explicit-tcy",
    description: "Explicit [tate]...[/tate] TCY notation — PRIMARY parity fixture (bare auto-detect is P3-O07, OPEN, not comparable — see evidence doc).",
    legacySource,
    v2BodyUnits: units,
    v2Source: source,
    capacity: { charsPerLine: 8, linesPerColumn: 5, columnCount: 1, bodyFontSizePt: 10 },
    expectations: NO_EXPECTATIONS,
  };
})();

const SEMANTIC_RUN_EXPECTATIONS: FixtureExpectations = {
  expectedDifferences: [],
  notComparable: [],
  treatTextSemanticRunEquivalent: true,
};

export const dashRunFixture: Fixture = (() => {
  const legacySource = "彼は――そうだ――と静かに言った";
  const { units, source } = buildFixtureUnits(BLOCK, [
    { kind: "TEXT", text: "彼は" },
    { kind: "SEMANTIC_RUN", text: "――", runKind: "DASH" },
    { kind: "TEXT", text: "そうだ" },
    { kind: "SEMANTIC_RUN", text: "――", runKind: "DASH" },
    { kind: "TEXT", text: "と静かに言った" },
  ]);
  return {
    id: "dash-run",
    description: "――dash run, cl-08 same-kind inseparable pair, kept together on the line that fits it.",
    legacySource,
    v2BodyUnits: units,
    v2Source: source,
    capacity: { charsPerLine: 5, linesPerColumn: 5, columnCount: 1, bodyFontSizePt: 10 },
    expectations: SEMANTIC_RUN_EXPECTATIONS,
  };
})();

export const ellipsisRunFixture: Fixture = (() => {
  const legacySource = "……そうか……と彼はつぶやいた";
  const { units, source } = buildFixtureUnits(BLOCK, [
    { kind: "SEMANTIC_RUN", text: "……", runKind: "ELLIPSIS" },
    { kind: "TEXT", text: "そうか" },
    { kind: "SEMANTIC_RUN", text: "……", runKind: "ELLIPSIS" },
    { kind: "TEXT", text: "と彼はつぶやいた" },
  ]);
  return {
    id: "ellipsis-run",
    description: "……ellipsis run, same mechanism as dash.",
    legacySource,
    v2BodyUnits: units,
    v2Source: source,
    capacity: { charsPerLine: 5, linesPerColumn: 5, columnCount: 1, bodyFontSizePt: 10 },
    expectations: SEMANTIC_RUN_EXPECTATIONS,
  };
})();

// EXPECTED_DIFFERENCE, pre-declared from direct source reading (not
// discovered after the fact): legacy's `tokenLength` returns 0 for an
// image (PHASE3_OPEN_ITEMS.md / Editor Inventory §9 "images render as
// absolute overlays, zero pagination cost"); v2's images have consumed
// real `MeasurementFacts` extent since P3-L15A
// (`typesetting-v2/core/layout/... P3-L15A` — see PHASE3_LOOP_LOG.md).
// Capacity note: `createFakeMeasurementProvider()`'s `imageIntrinsicTick`
// derives its OWN size from a hash of `refId` (its own doc comment:
// "deterministic fixture... never reads file bytes") — it does NOT read
// this fixture's own `intrinsicWidthTicks`/`intrinsicHeightTicks` fields at
// all (those exist only because `ImageUnit` requires them; a real
// Renderer-facing provider would use them, the fake one doesn't need to).
// For refId "img1" the fake provider resolves a real composed cost of 7056
// ticks (2 cells at 10pt) — confirmed by running this fixture, not assumed
// — so charsPerLine=9/linesPerColumn=1 is tuned against THAT actual cost:
// legacy's 8 flowed characters fit one line (charsPerLine=9); v2's
// equivalent 8 characters + the image's 2-cell cost (10 cells total) do
// not, forcing a second page.
export const imageFlowFixture: Fixture = (() => {
  const legacySource = "本文の前【IMG:img1:40:30:center】本文の後";
  const { units, source } = buildFixtureUnits(BLOCK, [
    { kind: "TEXT", text: "本文の前" },
    { kind: "IMAGE", refId: "img1", intrinsicWidthTicks: 40000, intrinsicHeightTicks: 30000, placement: "CENTER" },
    { kind: "TEXT", text: "本文の後" },
  ]);
  return {
    id: "image-flow",
    description: "Legacy: image costs 0 (absolute overlay). v2: image consumes real MeasurementFacts extent (P3-L15A).",
    legacySource,
    v2BodyUnits: units,
    v2Source: source,
    capacity: { charsPerLine: 9, linesPerColumn: 1, columnCount: 1, bodyFontSizePt: 10 },
    expectations: expect([
      { pathPrefix: "pages.length", reasonCode: "EXPECTED_IMAGE_FLOW_V2", severity: "MEDIUM", notes: "legacy image tokenLength=0; v2 image consumes real MeasurementFacts extent since P3-L15A." },
      { pathPrefix: "page[", reasonCode: "EXPECTED_IMAGE_FLOW_V2", severity: "MEDIUM", notes: "downstream of the page-count divergence above." },
    ]),
  };
})();

// EXPECTED_DIFFERENCE, pre-declared: F06 hanging punctuation
// (ぶら下げ組, TSP-LOOP-029) is Category B "Expected Deferred" per
// `P3_CORE_LOOP_ROADMAP.md`/`P3_G1_CANONICAL_CORE_REVIEW.md` — confirmed
// structurally absent from `core/compose/` by direct grep (no "hanging"
// match anywhere under `core/compose/`). Legacy hangs a lone 。/、 one slot
// past capacity instead of pushing it to the next line; v2 has no such
// mechanism and will ordinarily kinsoku-defer it instead.
export const hangingPunctuationFixture: Fixture = (() => {
  const legacySource = "それはとても静かな夜だった。窓の外には雪が降っていた";
  const { units, source } = buildFixtureUnits(BLOCK, [{ kind: "TEXT", text: legacySource }]);
  return {
    id: "hanging-punctuation-f06",
    description: "ぶら下げ組: legacy hangs a lone 。 past capacity; v2 has no F06 mechanism (deferred, Category B).",
    legacySource,
    v2BodyUnits: units,
    v2Source: source,
    capacity: { charsPerLine: 13, linesPerColumn: 5, columnCount: 1, bodyFontSizePt: 10 },
    expectations: expect([
      { pathPrefix: "page[", reasonCode: "EXPECTED_F06_HANGING_DEFERRED", severity: "LOW", notes: "F06 (ぶら下げ組) is Category B Expected Deferred, not yet implemented in v2 Core — see P3_CORE_LOOP_ROADMAP.md / P3_G1_CANONICAL_CORE_REVIEW.md." },
    ]),
  };
})();

// NEWLY DISCOVERED GAP (Stage C finding, not yet numbered as a Phase 3 open
// item — see evidence doc §"Unexpected Differences"): legacy treats a bare
// "\n" as an UNCONDITIONAL forced line break, regardless of remaining
// capacity (`paginateTokensByLines`'s own "\n" branch always calls
// `breakLine()`). v2's LogicalUnit model has no unit kind representing a
// manuscript paragraph break at all — a literal "\n" embedded in a
// TextUnit's `text` is just an ordinary character to
// `breaks/opportunity.ts` (classified by character class like any other
// code point, confirmed by direct read — no special-casing exists). This
// fixture uses a generous capacity so the divergence is attributable ONLY
// to this gap, not to unrelated capacity pressure. Left as raw
// UNEXPECTED_DIFFERENCE (no expectations declared) — this is NOT an
// already-frozen Product decision, so it must not be silently reclassified
// as "expected."
export const paragraphBreakGapFixture: Fixture = (() => {
  const first = "第一段落です。";
  const second = "第二段落です。";
  const legacySource = `${first}\n${second}`;
  const { units, source } = buildFixtureUnits(BLOCK, [{ kind: "TEXT", text: `${first}\n${second}` }]);
  return {
    id: "paragraph-break-gap",
    description: "NEWLY DISCOVERED: legacy forces a line break at every bare \\n; v2 has no equivalent unit/mechanism.",
    legacySource,
    v2BodyUnits: units,
    v2Source: source,
    capacity: { charsPerLine: 20, linesPerColumn: 5, columnCount: 1, bodyFontSizePt: 10 },
    expectations: NO_EXPECTATIONS,
  };
})();

// NEWLY DISCOVERED GAP candidate (pre-derived from direct source reading of
// `paginateTokensByLines`'s UTF-16, one-code-unit-at-a-time room loop, with
// NO surrogate-pair guard anywhere in `adjustLineSplit`/kinsoku/nowrap
// checks — confirmed by direct read before running anything). charsPerLine
// is chosen so the naive room boundary lands EXACTLY between the emoji's
// high and low surrogate halves after TSP-LOOP-029's own auto-indent (-1 on
// a paragraph's first line): budget = charsPerLine-1 = 6 must land at
// UTF-16 index 6, which is exactly the emoji's low-surrogate index in
// "あいうえお😀かきくけこ" (5 BMP chars + high-surrogate = index 0..5,
// low-surrogate at index 6). v2's INV-011 (graphemeBoundaries) guarantees
// this can never happen on v2's side.
export const supplementaryPlaneCharFixture: Fixture = (() => {
  const legacySource = "あいうえお😀かきくけこ";
  const { units, source } = buildFixtureUnits(BLOCK, [{ kind: "TEXT", text: legacySource }]);
  return {
    id: "supplementary-plane-char",
    description: "Emoji (astral, surrogate pair) positioned to land on legacy's naive UTF-16 split boundary.",
    legacySource,
    v2BodyUnits: units,
    v2Source: source,
    capacity: { charsPerLine: 7, linesPerColumn: 5, columnCount: 1, bodyFontSizePt: 10 },
    expectations: expect([
      {
        pathPrefix: "document.concatenatedText.surrogatePairIntegrity",
        reasonCode: "EXPECTED_V2_GRAPHEME_SAFETY_LEGACY_UTF16_UNSAFE",
        severity: "HIGH",
        notes: "Legacy's paginateTokensByLines indexes UTF-16 code units one at a time with no surrogate-pair guard anywhere in adjustLineSplit/kinsoku/nowrap — a real legacy correctness gap (INV-011 exists precisely to prevent this on v2's side), not a frozen policy difference. Flagged HIGH as a genuine bug candidate, out of this Loop's scope to fix (old engine is read-only). Confirmed by direct test: legacy's line 0 ends with lone surrogate U+D83D, line 1 begins with lone surrogate U+DE00 — the two halves of the emoji, split apart. NOTE: simple concatenated-text comparison alone cannot detect this (see document.concatenatedText — it MATCHes despite the split, because string concatenation trivially rejoins split surrogate halves); a dedicated per-line well-formedness check was added to classify.ts specifically because this fixture's own result proved the concatenated-text check insufficient.",
      },
      { pathPrefix: "page[", reasonCode: "EXPECTED_V2_GRAPHEME_SAFETY_LEGACY_UTF16_UNSAFE", severity: "HIGH", notes: "downstream of the surrogate-pair split above." },
    ]),
  };
})();

export const ALL_FIXTURES: Fixture[] = [
  canonicalSentenceFixture,
  longProseFixture,
  baselineKanaFixture,
  kinsokuLineStartFixture,
  kinsokuLineEndFixture,
  manualPageBreakFixture,
  twoColumnFlowFixture,
  atomicRubyFixture,
  jukugoRubyFixture,
  explicitTcyFixture,
  dashRunFixture,
  ellipsisRunFixture,
  imageFlowFixture,
  hangingPunctuationFixture,
  paragraphBreakGapFixture,
  supplementaryPlaneCharFixture,
];
