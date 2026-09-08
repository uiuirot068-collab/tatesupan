// P3-O08 -- Final-page completion, Step 2 (Human Visual QA HOLD round
// 29A): QA-ARTIFACT-ONLY remediation. Human HOLD (not a rejection of
// the implementation/test suite) on round 28/29's own
// `structural-colophon-final-product-qa.pdf`: its documents shared the
// SAME `PageCompositionSettings` used by round 27's own deliberate
// overflow-proof fixture (`charsPerLine:10, linesPerColumn:2` -- 20
// chars/page, 2 lines/page) for EVERY document, including ones meant
// to show a normal, complete colophon. A normal 6-7-field colophon
// needs ~8 composed lines; at 2 lines/page that is ALWAYS >1 colophon
// page, regardless of any placement/margin setting being compared --
// an artificial QA-fixture capacity choice, not a Core/Publication
// defect. (Core's own `composePages` mechanism is exactly correct:
// given a real page capacity that small, real content really would
// overflow. The bug is which capacity a "show one normal colophon"
// fixture used.) ROOT CAUSE: CASE A (QA-fixture-only). No Core or
// Publication file changes in this round.
//
// This file is a NEW, separate, compact Human-review artifact. It does
// NOT replace the large diagnostic PDFs from rounds 26-29 (kept as
// engineering evidence for the 379 automated Publication tests), and
// it does NOT re-litigate anything those tests already prove by
// machine (page ordering, insertion, fallback, parity) -- see the
// "page order" section below, kept to exactly one compact scenario.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  composeCanonicalDocument,
  createFakeMeasurementProvider,
  DEFAULT_FOLIO_SETTINGS,
  DEFAULT_RULE_SET_V2,
  compileColophonContent,
  type HeaderSettings,
  type ColophonFieldInput,
  type ColophonCompiledContent,
  type ColophonPagePosition,
  type ColophonPlacement,
} from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, deriveBaselineRatioFromFont, renderPaintPlanToPdf, type PaintCommand, type PaintPlan, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { VerticalGposContext } from "./verticalGposPaint";
import { VerticalYakumonoAlignContext } from "./verticalYakumonoAlign";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits, type FixturePiece } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

// A REALISTIC page capacity -- not the round-27 overflow-proof fixture's
// own deliberately tiny one. 30 chars/line x 12 lines/column comfortably
// holds a normal 6-7-field colophon (~8 real composed lines) on ONE
// page, the same way a real 文庫/A5 page comfortably holds a normal
// colophon in the shipped product.
const NORMAL_CAPACITY = { charsPerLine: 30, linesPerColumn: 12, columnCount: 1 as const };
// Reserved for the "Root cause" describe block's own automated proof
// that this narrow capacity was the round-28/29 bug's real cause --
// never used for a Human-visible QA page (round 29B: Human QA FAIL on
// the original scenario 14, which DID use this for a visible page --
// see OVERFLOW_CAPACITY_HUMAN below).
const OVERFLOW_CAPACITY = { charsPerLine: 10, linesPerColumn: 2, columnCount: 1 as const };
// Human Visual QA HOLD round 29B: Human found the round-29A scenario 14
// unusable -- `OVERFLOW_CAPACITY`'s narrow `charsPerLine:10` is
// narrower than a single real field VALUE (`2026年9月8日` is 8 chars,
// `example@example.com` is 20), so Natural Pitch line-wrapping split
// those tokens mid-word across lines/pages -- not a realistic
// representation of overflow (a real product page is never narrower
// than one email address). This capacity keeps the SAME realistic
// width as `NORMAL_CAPACITY` (`charsPerLine:30`, so every real row
// stays atomic/whole on its own line, exactly like a normal page) and
// forces multi-page overflow ONLY by shrinking vertical capacity
// (`linesPerColumn:3`, too few lines for a normal ~8-line colophon) --
// overflow via genuine "too much content," never via "too narrow a
// column."
const OVERFLOW_CAPACITY_HUMAN = { charsPerLine: 30, linesPerColumn: 3, columnCount: 1 as const };

const QA_GEOMETRY: PublicationPageGeometry = {
  paperWidthMm: 105,
  paperHeightMm: 148,
  marginTopMm: 22,
  marginBottomMm: 8,
  marginLeftMm: 15,
  marginRightMm: 15,
  marginGutterMm: 26,
  marginOuterMm: 11,
};

function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

function realContexts() {
  const font = fontResource();
  const buf = readFileSync(FONT_PATH);
  return {
    font,
    outlineContext: new VerticalOutlineContext(buf),
    gposContext: new VerticalGposContext(buf),
    yakumonoContext: new VerticalYakumonoAlignContext(buf, deriveBaselineRatioFromFont(font)),
  };
}

// The user's own real, complete example colophon -- 6 visible fields +
// 2-line freeText, matching a normal shipped colophon exactly (not a
// minimal 1-field stub).
const FULL_FIELDS: ColophonFieldInput[] = [
  { label: "書名", value: "吾輩は猫である", visible: true },
  { label: "著者名", value: "夏目漱石", visible: true },
  { label: "サークル", value: "猫町文庫", visible: true },
  { label: "発行日", value: "2026年9月8日", visible: true },
  { label: "印刷所", value: "○○印刷", visible: true },
  { label: "連絡先", value: "example@example.com", visible: true },
  { label: "発行者", value: "", visible: false },
];
const FULL_FREETEXT = "本書をお手に取っていただきありがとうございます。\n無断転載・複製を禁じます。";

function colophonFixturePieces(content: ColophonCompiledContent): FixturePiece[] {
  const pieces: FixturePiece[] = [];
  content.rows.forEach((row, i) => {
    if (i > 0) pieces.push({ kind: "PARAGRAPH_BREAK" });
    pieces.push({ kind: "TEXT", text: `${row.label}\t${row.value}` });
  });
  if (content.freeText.trim() !== "") {
    const lines = content.freeText.split("\n");
    lines.forEach((line, i) => {
      if (content.rows.length > 0 || i > 0) pieces.push({ kind: "PARAGRAPH_BREAK" });
      pieces.push({ kind: "TEXT", text: line });
    });
  }
  return pieces;
}

interface ComposeOpts {
  folioSettings?: typeof DEFAULT_FOLIO_SETTINGS;
  headerSettings?: HeaderSettings;
  colophonPagePosition?: ColophonPagePosition;
  colophonPlacement?: ColophonPlacement;
  capacity?: { charsPerLine: number; linesPerColumn: number; columnCount: 1 | 2 };
}

function composeFull(bodyText: string, fields: ColophonFieldInput[], freeText: string, opts: ComposeOpts = {}) {
  const compiled = compileColophonContent({ fields, freeText });
  const pieces = colophonFixturePieces(compiled);
  const { units: bodyUnits, source: bodySource } = buildFixtureUnits("body", [{ kind: "TEXT", text: bodyText }]);
  const colophonBuild = pieces.length > 0 ? buildFixtureUnits("colophon", pieces) : undefined;
  const settings = settingsFor(opts.capacity ?? NORMAL_CAPACITY);
  const measurement = createFakeMeasurementProvider();
  const document = composeCanonicalDocument({
    bodyUnits,
    colophonUnits: colophonBuild?.units,
    colophonBlockId: "colophon",
    ruleSet: DEFAULT_RULE_SET_V2,
    measurement,
    settings,
    folioSettings: opts.folioSettings,
    headerSettings: opts.headerSettings,
    colophonPagePosition: opts.colophonPagePosition,
    colophonPlacement: opts.colophonPlacement,
  });
  const ctx: PublicationRenderContext = {
    linePitchTicks: settings.linePitchTicks,
    lineExtentTicks: settings.lineExtentTicks,
    columnExtentTicks: settings.columnExtentTicks,
    columnsPerPage: settings.columnsPerPage,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
  };
  const model = colophonBuild
    ? buildPublicationDocument("qa", "QA", document, bodyUnits, bodySource, ctx, colophonBuild.units, colophonBuild.source)
    : buildPublicationDocument("qa", "QA", document, bodyUnits, bodySource, ctx);
  return { document, model };
}

const HEADER_SETTINGS: HeaderSettings = { hashiraOdd: "奇数柱", hashiraEven: "偶数柱", position: { band: "top", horizontal: "outer" } };

// QA-ONLY label -- never painted by any real Core/Publication path,
// added here directly onto the already-built PaintPlan so it can never
// be mistaken for real colophon content. Placed in the page's own
// margin corner (never inside the real placement area).
function withQaLabel(plan: PaintPlan, colophonPlanIndex: number, label: string): PaintPlan {
  plan[colophonPlanIndex].commands.push({ op: "text", text: `QA: ${label}`, xMm: 3, yMm: 6, fontSizePt: 7, align: "left", angle: 0 });
  return plan;
}

function scenario(label: string, bodyText: string, fields: ColophonFieldInput[], freeText: string, opts: ComposeOpts) {
  const { outlineContext, gposContext, yakumonoContext } = realContexts();
  const { model, document } = composeFull(bodyText, fields, freeText, opts);
  const plan = buildPaintPlan(model, true, QA_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
  const colophonIdx = document.pageSequence.map((r, i) => ({ r, i })).filter((x) => x.r.kind === "colophon").map((x) => x.i);
  for (const idx of colophonIdx) withQaLabel(plan, idx, label);
  // Human review only needs the colophon page(s) themselves for a
  // placement/margin comparison -- body pages add nothing to compare
  // and only inflate page count (round-29A's own root-cause fix, see
  // top-of-file comment). `colophonOnly` is what most scenarios use;
  // the full `plan` (with body pages) is kept only for the one
  // dedicated page-order scenario.
  const colophonOnly = colophonIdx.map((i) => plan[i]);
  return { plan, colophonOnly, document };
}

describe("Root cause -- confirms CASE A (QA-fixture-only), not a product bug", () => {
  it("a normal, complete colophon (6 fields + 2-line freeText) composes onto EXACTLY ONE page under a realistic page capacity (test A)", () => {
    const { document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {});
    expect(document.colophon?.pages.length).toBe(1);
  });

  it("the SAME normal colophon content, under the round-27/28/29 diagnostic overflow capacity, DOES fragment across many pages -- proving the capacity choice, not Core/Publication, caused the unreviewable round-28/29 artifact (test B)", () => {
    const { document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, { capacity: OVERFLOW_CAPACITY });
    expect(document.colophon?.pages.length).toBeGreaterThan(1);
  });

  it("an explicit, deliberately oversized fixture still legitimately overflows under the realistic capacity too, when content truly exceeds one page's own real capacity (test C -- overflow itself is real, correctly-scoped behavior, not disabled)", () => {
    const manyFields: ColophonFieldInput[] = [
      ...FULL_FIELDS,
      { label: "備考1", value: "追加情報その一", visible: true },
      { label: "備考2", value: "追加情報その二", visible: true },
      { label: "備考3", value: "追加情報その三", visible: true },
      { label: "備考4", value: "追加情報その四", visible: true },
      { label: "備考5", value: "追加情報その五", visible: true },
    ];
    const { document } = composeFull("あいうえお", manyFields, FULL_FREETEXT + "\n三行目\n四行目\n五行目\n六行目", {});
    expect(document.colophon?.pages.length).toBeGreaterThan(1);
  });
});

describe("QA -- structural-colophon-human-review-qa.pdf (compact, judgeable)", () => {
  it(
    "14 focused scenarios + 1 compact page-order sample, every normal scenario a single complete colophon page",
    () => {
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const bodyText = "「今日は、雨だった。」きっとやってくる。";
    const place = (horizontal: ColophonPlacement["horizontal"], vertical: ColophonPlacement["vertical"], respectGutter = true, respectVerticalMargins = true): ColophonPlacement => ({
      horizontal,
      vertical,
      respectGutter,
      respectVerticalMargins,
    });

    const scenarios: PaintPlan[] = [];
    const pushScenario = (label: string, opts: ComposeOpts) => {
      const { colophonOnly } = scenario(label, bodyText, FULL_FIELDS, FULL_FREETEXT, { folioSettings: DEFAULT_FOLIO_SETTINGS, headerSettings: HEADER_SETTINGS, ...opts });
      expect(colophonOnly.length).toBe(1); // every normal comparison scenario: one complete colophon page
      scenarios.push(colophonOnly);
    };

    // 1-7: position matrix, identical content, one setting changed at a time.
    pushScenario("1 DEFAULT center/center", { colophonPlacement: place("center", "center") });
    pushScenario("2 LEFT / TOP", { colophonPlacement: place("left", "top") });
    pushScenario("3 CENTER / TOP", { colophonPlacement: place("center", "top") });
    pushScenario("4 RIGHT / TOP", { colophonPlacement: place("right", "top") });
    pushScenario("5 LEFT / BOTTOM", { colophonPlacement: place("left", "bottom") });
    pushScenario("6 CENTER / BOTTOM", { colophonPlacement: place("center", "bottom") });
    pushScenario("7 RIGHT / BOTTOM", { colophonPlacement: place("right", "bottom") });

    // 8-11: respectGutter x odd/even parity. Odd physical colophon page needs
    // a 2-body-page document (colophon lands on physical page 3); even uses
    // the default 1-body-page document (colophon lands on physical page 2).
    const twoPageBody = "あ".repeat(400); // 360 + 40 -> 2 real body pages -> colophon physical page 3 (odd)
    const pushOddScenario = (label: string, respectGutter: boolean) => {
      const { colophonOnly } = scenario(label, twoPageBody, FULL_FIELDS, FULL_FREETEXT, {
        folioSettings: DEFAULT_FOLIO_SETTINGS,
        headerSettings: HEADER_SETTINGS,
        colophonPlacement: place("left", "center", respectGutter, true),
      });
      expect(colophonOnly.length).toBe(1);
      scenarios.push(colophonOnly);
    };
    pushOddScenario("8 respectGutter TRUE / odd page", true);
    pushOddScenario("9 respectGutter FALSE / odd page", false);
    pushScenario("10 respectGutter TRUE / even page", { colophonPlacement: place("left", "center", true, true) });
    pushScenario("11 respectGutter FALSE / even page", { colophonPlacement: place("left", "center", false, true) });

    // 12-13: respectVerticalMargins.
    pushScenario("12 respectVerticalMargins TRUE", { colophonPlacement: place("center", "top", true, true) });
    pushScenario("13 respectVerticalMargins FALSE", { colophonPlacement: place("center", "top", true, false) });

    // 14: ONE explicitly labeled overflow diagnostic -- round 29B:
    // realistic horizontal width (every row/date/email stays atomic,
    // never split mid-token), overflow forced only by real content
    // quantity exceeding a short page's real vertical capacity.
    {
      const { colophonOnly, document } = scenario("14 OVERFLOW DIAGNOSTIC (realistic width, short page -- vertical overflow only)", "あいうえお", FULL_FIELDS, FULL_FREETEXT, {
        capacity: OVERFLOW_CAPACITY_HUMAN,
      });
      expect(document.colophon!.pages.length).toBeGreaterThan(1);
      // Round 29B's own regression guard (mid-token splitting caused by
      // an unrealistically NARROW capacity) is frozen and stays fixed --
      // proven separately in "Root cause" above. Round 29D adds a real,
      // narrower value-column frame (title-row-derived), under which a
      // value WIDER than that frame (e.g. a long email) may legitimately
      // wrap -- so "must paint as one whole command" is no longer the
      // right check. What must still hold: every character of the real
      // value survives, in order, reconstructable by concatenating its
      // own consecutive painted fragments (no loss, no reordering,
      // even when wrapped).
      const compiled = compileColophonContent({ fields: FULL_FIELDS, freeText: FULL_FREETEXT });
      const paintedTexts = colophonOnly.flatMap((page) => page.commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text").map((c) => c.text));
      const allPaintedText = paintedTexts.join("");
      for (const row of compiled.rows) {
        expect(allPaintedText).toContain(row.value); // whole (if it fit) or reconstructable across consecutive wrapped fragments
      }
      scenarios.push(colophonOnly);
    }

    // 15: ONE compact page-order sample -- body -> colophon -> body, real
    // folio/header parity visible, never re-proving what the 379
    // automated tests already prove by machine.
    {
      const { plan, document } = scenario("15 PAGE ORDER: body -> colophon -> body (after-body-page:1)", twoPageBody, FULL_FIELDS, "", {
        folioSettings: DEFAULT_FOLIO_SETTINGS,
        headerSettings: HEADER_SETTINGS,
        colophonPagePosition: { mode: "after-body-page", afterBodyPage: 1 },
      });
      expect(document.pageSequence).toEqual([{ kind: "body", index: 0 }, { kind: "colophon", index: 0 }, { kind: "body", index: 1 }]);
      scenarios.push(plan);
    }

    const pages = scenarios.flat();
    const { bytes, pageCount } = renderPaintPlanToPdf(pages, font);
    expect(pageCount).toBe(pages.length);
    expect(pages.length).toBeLessThan(25); // compact -- not 32, not 60 (13 single-page comparisons + one multi-page overflow diagnostic + one 3-page order sample)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "structural-colophon-human-review-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
    },
    30000 // Human Visual QA HOLD round 29D: real per-character font-metric measurement across 15 scenarios is heavier than the default 5000ms budget under full-suite CPU contention (parallel test files) -- passes comfortably in ~2.5s standalone; this raises the test's own timeout, it does not mask a hang (confirmed: standalone run completes in ~2.7s total).
  );
});

describe("Regression", () => {
  it("full vitest/tsc-relevant real-pipeline smoke check (Ruby/Small Kana/Dash/TCY/Ellipsis/Folio/Header) with the realistic capacity", () => {
    const bodyText = "「今日は、雨だった。」きっと２０２６年";
    const { model } = composeFull(bodyText, FULL_FIELDS, FULL_FREETEXT, { folioSettings: DEFAULT_FOLIO_SETTINGS, headerSettings: HEADER_SETTINGS });
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, QA_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(outlineContext.inkCenteredBaselineRatioForSmallKana("っ")).toBeDefined();
  });
});
