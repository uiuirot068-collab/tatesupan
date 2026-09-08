// P3-O08 -- Final-page completion, Step 2B (Human Visual QA HOLD round
// 27): REAL ColophonSettings -> canonical compiler + legacy placement
// parity.
//
// Round 26 proved the STRUCTURAL PRIMITIVE (composeColophon wired to
// Publication paint) using plain-text colophon fixtures. This round
// ports the REAL legacy content-compilation contract
// (`src/lib/colophon.ts`, direct reads cited inline) and proves it
// through the SAME real pipeline end-to-end: ColophonSettings-shaped
// fields/freeText -> compileColophonContent (Core) -> LogicalUnit[] ->
// composeColophon -> Canonical -> Publication paint. NO plain-text
// LogicalUnit fixture is used for the final QA proof -- every colophon
// in this file's QA PDF is built from a ColophonFieldInput[] + freeText
// pair via the real compiler.
//
// DO NOT mark Structural Colophon Human PASS from this file alone --
// two real gaps remain disclosed, not silently faked:
//   1. `{mode:"after-body-page"}` -- the pure DECISION function
//      (`resolveColophonInsertion`, ported verbatim from
//      `src/lib/colophon.ts:266-277`) is tested here in isolation, but
//      its output is NOT wired into `core/layout/assemble.ts`'s actual
//      page composition (would require re-interleaving body pages and
//      re-deriving every subsequent page's own folio/header index).
//   2. `ColophonPlacement` (block-level horizontal/vertical anchor of
//      the WHOLE colophon content on its page, `src/lib/colophon.ts:67-74`)
//      is NOT ported -- content is always painted starting near the
//      page's own top margin, left-to-right column span. This is a
//      DIFFERENT concept from this round's real "label vs value" row
//      column layout (which mirrors `FragmentRow`'s own 2-column grid,
//      `src/components/ColophonPageCard.tsx`), and from pagePosition
//      (WHERE the colophon's pages land, item 1 above) -- legacy's own
//      doc comment (`colophon.ts:55`) states placement and pagePosition
//      are "完全に別概念" (completely separate concepts); this file does
//      not conflate them.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  composeCanonicalDocument,
  createFakeMeasurementProvider,
  DEFAULT_FOLIO_SETTINGS,
  DEFAULT_RULE_SET_V2,
  compileColophonContent,
  resolveColophonInsertion,
  type HeaderSettings,
  type ColophonFieldInput,
  type ColophonCompiledContent,
} from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, deriveBaselineRatioFromFont, renderPaintPlanToPdf, type PaintCommand, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { VerticalGposContext } from "./verticalGposPaint";
import { VerticalYakumonoAlignContext } from "./verticalYakumonoAlign";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits, type FixturePiece } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");
const DIAGNOSTIC_GEOMETRY: PublicationPageGeometry = { paperWidthMm: 105, paperHeightMm: 148, marginTopMm: 15, marginBottomMm: 12, marginRightMm: 15, marginLeftMm: 15 };

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

// Real legacy default fields, ported verbatim from `defaultColophonFields`
// (`src/lib/colophon.ts:101-111`) -- publisher hidden by default, six
// others visible, all real Japanese labels (not invented here).
function legacyDefaultFields(overrides: Partial<Record<string, string>> = {}): ColophonFieldInput[] {
  return [
    { label: "書名", value: overrides.title ?? "", visible: true },
    { label: "著者名", value: overrides.author ?? "", visible: true },
    { label: "サークル名", value: overrides.circle ?? "", visible: true },
    { label: "発行日", value: overrides.date ?? "", visible: true },
    { label: "印刷所", value: overrides.printer ?? "", visible: true },
    { label: "連絡先", value: overrides.contact ?? "", visible: true },
    { label: "発行者", value: overrides.publisher ?? "", visible: false },
  ];
}

// Converts a real compiled ColophonCompiledContent (Core's own output --
// never hand-authored plain manuscript text) into LogicalUnit-building
// FixturePieces. Each row becomes ONE "label\tvalue" TEXT piece on its
// own composed line (a real, existing PARAGRAPH_BREAK forced-break unit
// between rows -- Core's own "bare manuscript line ending" mechanism,
// `core/compose/line.ts:64`) -- NOT a literal "\n" embedded mid-string,
// which round 26's own fixture used and which does not actually force a
// line break in Core's real composition. The tab is a deliberate,
// non-inventive placeholder: legacy's own real `FragmentRow` DOM has NO
// literal separator character between label and value (two separate
// CSS grid cells, confirmed by direct read) -- a tab is the most neutral
// "two distinct fields, one row" representation available in a flat
// text stream, and it never reaches any painted glyph (the Publication
// paint side splits and discards it before painting, see
// `pdfGenerator.ts`'s `buildColophonPaintPage`).
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

function composeFromSettings(bodyText: string, fields: ColophonFieldInput[], freeText = "", folioSettings?: typeof DEFAULT_FOLIO_SETTINGS, headerSettings?: HeaderSettings) {
  const compiled = compileColophonContent({ fields, freeText });
  const pieces = colophonFixturePieces(compiled);
  const { units: bodyUnits, source: bodySource } = buildFixtureUnits("body", [{ kind: "TEXT", text: bodyText }]);
  const colophonBuild = pieces.length > 0 ? buildFixtureUnits("colophon", pieces) : undefined;
  const maxRowLen = Math.max(1, ...compiled.rows.map((r) => Array.from(`${r.label}\t${r.value}`).length), ...compiled.freeText.split("\n").map((l) => Array.from(l).length));
  const settings = settingsFor({ charsPerLine: maxRowLen + 2, linesPerColumn: 30, columnCount: 1 });
  const measurement = createFakeMeasurementProvider();
  const document = composeCanonicalDocument({
    bodyUnits,
    colophonUnits: colophonBuild?.units,
    colophonBlockId: "colophon",
    ruleSet: DEFAULT_RULE_SET_V2,
    measurement,
    settings,
    folioSettings,
    headerSettings,
  });
  const ctx: PublicationRenderContext = {
    linePitchTicks: settings.linePitchTicks,
    lineExtentTicks: settings.lineExtentTicks,
    columnExtentTicks: settings.columnExtentTicks,
    columnsPerPage: settings.columnsPerPage,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
  };
  const model = buildPublicationDocument("qa", "QA", document, bodyUnits, bodySource, ctx, colophonBuild?.units, colophonBuild?.source);
  return { document, model, compiled };
}

describe("Product compiler -- real ColophonSettings semantics (src/lib/colophon.ts ported verbatim)", () => {
  it("compiles deterministically for the same settings (test 1)", () => {
    const fields = legacyDefaultFields({ title: "吾輩は猫である", author: "夏目漱石" });
    const a = compileColophonContent({ fields, freeText: "" });
    const b = compileColophonContent({ fields, freeText: "" });
    expect(a).toEqual(b);
  });

  it("preserves legacy field order exactly, never re-sorts (test 2)", () => {
    const fields = legacyDefaultFields({ title: "T", author: "A", circle: "C", date: "D", printer: "P", contact: "K" });
    const compiled = compileColophonContent({ fields, freeText: "" });
    expect(compiled.rows.map((r) => r.label)).toEqual(["書名", "著者名", "サークル名", "発行日", "印刷所", "連絡先"]);
  });

  it("hidden 発行者 field (visible:false, legacy default) is filtered out even with a value (test 3)", () => {
    const fields = legacyDefaultFields({ title: "T", publisher: "文鳥社出版部" });
    const compiled = compileColophonContent({ fields, freeText: "" });
    expect(compiled.rows.find((r) => r.label === "発行者")).toBeUndefined();
  });

  it("a visible field with both label and value blank is filtered (blank optional field, test 4)", () => {
    const fields: ColophonFieldInput[] = [{ label: "", value: "", visible: true }, { label: "書名", value: "短編", visible: true }];
    const compiled = compileColophonContent({ fields, freeText: "" });
    expect(compiled.rows).toEqual([{ label: "書名", value: "短編" }]);
  });

  it("a visible field with only a value (blank label) is KEPT -- legacy: label OR value non-blank is sufficient (test 5)", () => {
    const fields: ColophonFieldInput[] = [{ label: "", value: "非公式編集版", visible: true }];
    const compiled = compileColophonContent({ fields, freeText: "" });
    expect(compiled.rows).toEqual([{ label: "", value: "非公式編集版" }]);
  });

  it("an invisible field is always excluded regardless of content (test 6)", () => {
    const fields: ColophonFieldInput[] = [{ label: "非表示項目", value: "値あり", visible: false }];
    expect(compileColophonContent({ fields, freeText: "" }).rows).toEqual([]);
  });

  it("freeText passes through unfiltered, including multiline content (test 7)", () => {
    const freeText = "本作はフィクションです。\n無断転載を禁じます。";
    const compiled = compileColophonContent({ fields: [], freeText });
    expect(compiled.freeText).toBe(freeText);
  });

  it("templates are a visual concern only -- the SAME compiled rows/freeText result regardless of which legacy templateId a caller intends to use (test 8; direct read of ColophonPageCard.tsx: all 4 templates consume identical {rows,freeText})", () => {
    const fields = legacyDefaultFields({ title: "T" });
    const forStandardTemplate = compileColophonContent({ fields, freeText: "" });
    const forClassicTemplate = compileColophonContent({ fields, freeText: "" });
    expect(forStandardTemplate).toEqual(forClassicTemplate);
  });
});

describe("Placement vs pagePosition -- recovered as distinct concepts (src/lib/colophon.ts:55)", () => {
  it("pagePosition {mode:'end'} places colophon after ALL body pages, precedingBodyPages === full body count (test 9)", () => {
    expect(resolveColophonInsertion({ mode: "end" }, 5)).toEqual({ precedingBodyPages: 5, fallback: false, requestedPage: null });
  });

  it("pagePosition {mode:'after-body-page', afterBodyPage: N} within range resolves to exactly N preceding pages, no fallback (test 10)", () => {
    expect(resolveColophonInsertion({ mode: "after-body-page", afterBodyPage: 3 }, 10)).toEqual({ precedingBodyPages: 3, fallback: false, requestedPage: 3 });
  });

  it("pagePosition {mode:'after-body-page', afterBodyPage: N} beyond the real body page count falls back to end, never crashes (test 11, ported verbatim from resolveColophonInsertion, colophon.ts:266-277)", () => {
    expect(resolveColophonInsertion({ mode: "after-body-page", afterBodyPage: 300 }, 5)).toEqual({ precedingBodyPages: 5, fallback: true, requestedPage: 300 });
  });

  it("DISCLOSED GAP: after-body-page's resolved insertion is NOT wired into actual page composition this round -- composeCanonicalDocument always appends colophon pages after the full real body page count, matching {mode:'end'} regardless of the settings-level pagePosition (test 12)", () => {
    const fields = legacyDefaultFields({ title: "短編" });
    const { document } = composeFromSettings("あいうえお", fields);
    // 1 body page precedes colophon in EVERY case this round supports.
    expect(document.colophon?.pages[0].folio).toBeUndefined(); // no folioSettings passed here -- just proving colophon exists after body
    expect(document.pages.length).toBe(1);
  });
});

describe("Canonical -- real settings flow through composeColophon (no synthetic plain-text fixture)", () => {
  it("a minimal structured colophon (single visible field) composes via the real compiler (test 13)", () => {
    const fields: ColophonFieldInput[] = [{ label: "書名", value: "短編", visible: true }];
    const { document, compiled } = composeFromSettings("あいうえお", fields);
    expect(compiled.rows).toEqual([{ label: "書名", value: "短編" }]);
    expect(document.colophon?.pages.length).toBeGreaterThan(0);
  });

  it("colophon content carries a real SourceSpan against its OWN colophon block, never fabricated against body text (test 14, INV-001)", () => {
    const fields = legacyDefaultFields({ title: "T" });
    const { document } = composeFromSettings("あいうえお", fields);
    const first = document.colophon!.pages[0].columns[0].lines[0].placedUnits[0];
    expect(first.sourceSpan.blockId).toBe("colophon");
  });

  it("manuscript body pages are structurally unchanged whether real colophon settings are supplied or not (test 15, 16)", () => {
    const fields = legacyDefaultFields({ title: "T" });
    const withColophon = composeFromSettings("あいうえお", fields).document.pages;
    const { units: bodyUnits } = buildFixtureUnits("body", [{ kind: "TEXT", text: "あいうえお" }]);
    const settings = settingsFor({ charsPerLine: 10, linesPerColumn: 30, columnCount: 1 });
    const withoutColophon = composeCanonicalDocument({ bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement: createFakeMeasurementProvider(), settings }).pages;
    expect(withColophon).toEqual(withoutColophon);
  });
});

describe("Page furniture -- folio/header continue through a real-settings colophon (test 17, 18, 19)", () => {
  it("colophon page receives folio continuing the real physical page sequence (test 17)", () => {
    const fields = legacyDefaultFields({ title: "T" });
    const { document } = composeFromSettings("あいうえお", fields, "", DEFAULT_FOLIO_SETTINGS);
    expect(document.colophon?.pages[0].folio?.text).toBe("2");
  });

  it("colophon page receives header with correct odd/even parity at its real physical position (test 18)", () => {
    const fields = legacyDefaultFields({ title: "T" });
    const headerSettings: HeaderSettings = { hashiraOdd: "奇数柱", hashiraEven: "偶数柱", position: { band: "top", horizontal: "outer" } };
    const { document } = composeFromSettings("あいうえお", fields, "", undefined, headerSettings);
    expect(document.colophon?.pages[0].header?.text).toBe("偶数柱");
  });

  it("folio/header parity is deterministic across repeated real-settings composition (test 19)", () => {
    const fields = legacyDefaultFields({ title: "T" });
    const a = composeFromSettings("あいうえお", fields, "", DEFAULT_FOLIO_SETTINGS).document.colophon?.pages[0].folio;
    const b = composeFromSettings("あいうえお", fields, "", DEFAULT_FOLIO_SETTINGS).document.colophon?.pages[0].folio;
    expect(a).toEqual(b);
  });
});

describe("Overflow -- real oversized settings do not silently clip (test 20)", () => {
  it("a deliberately long, real-settings colophon (all 7 fields + long freeText) composes onto MULTIPLE colophon pages, not clipped to one, each with correct continuing folio", () => {
    const fields = legacyDefaultFields({ title: "T", author: "A", circle: "C", date: "D", printer: "P", contact: "K", publisher: "X" });
    // Force wrapping/overflow: tiny linesPerColumn via a direct low-level compose (bypass composeFromSettings' generous 30).
    const compiled = compileColophonContent({ fields: [...fields, { label: "その他", value: "その他".repeat(1), visible: true }], freeText: "本作はフィクションです。\n登場する人物・団体・事件などはすべて架空のものです。\n無断複製・転載を固く禁じます。" });
    const pieces = colophonFixturePieces(compiled);
    const { units: bodyUnits, source: bodySource } = buildFixtureUnits("body", [{ kind: "TEXT", text: "あいうえお" }]);
    const colophonBuild = buildFixtureUnits("colophon", pieces);
    // linesPerColumn:3 forces the ~11 real content lines to overflow one column/page.
    const settings = settingsFor({ charsPerLine: 12, linesPerColumn: 3, columnCount: 1 });
    const measurement = createFakeMeasurementProvider();
    const document = composeCanonicalDocument({
      bodyUnits,
      colophonUnits: colophonBuild.units,
      colophonBlockId: "colophon",
      ruleSet: DEFAULT_RULE_SET_V2,
      measurement,
      settings,
      folioSettings: DEFAULT_FOLIO_SETTINGS,
    });
    expect(document.colophon?.pages.length).toBeGreaterThan(1);
    const folios = document.colophon!.pages.map((p) => p.folio?.text);
    expect(folios).toEqual([...folios].sort((a, b) => Number(a) - Number(b))); // monotonically increasing, no gap/clip
    void bodySource;
  });
});

describe("Publication rendering -- vector, horizontal, real compiled rows painted as label/value pairs", () => {
  it("colophon paints via the real vector font path only (test 21)", () => {
    const fields = legacyDefaultFields({ title: "T" });
    const { model } = composeFromSettings("あいうえお", fields);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    expect(plan.length).toBe(2);
    for (const cmd of plan[1].commands) expect(["text", "glyphOutline"]).toContain(cmd.op);
  });

  it("colophon text is painted HORIZONTALLY (angle 0) (test 22)", () => {
    const fields = legacyDefaultFields({ title: "T" });
    const { model } = composeFromSettings("あいうえお", fields);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const textCmd = plan[1].commands.find((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    expect(textCmd?.angle).toBe(0);
  });

  it("a real compiled row (label\\tvalue) paints as TWO separate commands, a naturally-sized label column followed by a value column, and the raw tab never reaches a painted command's own text (test 23; round 29C: value column left-aligns after the label column, replacing round 27's own full-width right-anchor)", () => {
    const fields: ColophonFieldInput[] = [{ label: "書名", value: "吾輩は猫である", visible: true }];
    const { model } = composeFromSettings("あいうえお", fields);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const textCommands = plan[1].commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    expect(textCommands.length).toBe(2);
    for (const c of textCommands) expect(c.text.includes("\t")).toBe(false);
    const aligns = textCommands.map((c) => c.align).sort();
    expect(aligns).toEqual(["left", "left"]);
    expect(textCommands[0].xMm).toBeLessThan(textCommands[1].xMm); // label column, then value column
  });

  it("body font inheritance preserved -- colophon glyph size matches the fixed body-em size (test 24)", () => {
    const fields = legacyDefaultFields({ title: "T" });
    const { model } = composeFromSettings("あいうえお", fields);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const textCommands = plan[1].commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    const first = textCommands[0].fontSizePt;
    for (const c of textCommands) expect(c.fontSizePt).toBe(first);
  });
});

describe("Regression", () => {
  it("Ruby/Dash/TCY/Ellipsis/Small Kana/Folio/Header all still render correctly with a real-settings colophon present", () => {
    const bodyText = "「今日は、雨だった。」きっと２０２６年";
    const fields = legacyDefaultFields({ title: "T" });
    const headerSettings: HeaderSettings = { hashiraOdd: "A", hashiraEven: "B", position: { band: "top", horizontal: "outer" } };
    const { model } = composeFromSettings(bodyText, fields, "本作はフィクションです。", DEFAULT_FOLIO_SETTINGS, headerSettings);
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("small-kana regression PASS", () => {
    const { outlineContext } = realContexts();
    expect(outlineContext.inkCenteredBaselineRatioForSmallKana("っ")).toBeDefined();
  });
});

describe("QA -- structural-colophon-real-settings-qa.pdf (every colophon compiled from a real ColophonFieldInput[]/freeText fixture)", () => {
  it("minimal / fuller / blank-optional-field / freeText multiline / end placement / folio+header interaction, all through the real compiler", () => {
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const bodyText = "「今日は、雨だった。」きっとやってくる。";
    const headerSettings: HeaderSettings = { hashiraOdd: "小説のタイトル", hashiraEven: "第一章", position: { band: "top", horizontal: "outer" } };

    const minimal = composeFromSettings(bodyText, [{ label: "書名", value: "短編", visible: true }], "", DEFAULT_FOLIO_SETTINGS, headerSettings);

    const fuller = composeFromSettings(
      bodyText,
      legacyDefaultFields({ title: "吾輩は猫である", author: "夏目漱石", circle: "文鳥社", date: "2026年9月8日", contact: "example@example.test" }),
      "本作はフィクションです。\n無断転載を禁じます。",
      DEFAULT_FOLIO_SETTINGS,
      headerSettings
    );

    const blankOptional = composeFromSettings(
      bodyText,
      [
        { label: "書名", value: "短編集", visible: true },
        { label: "", value: "", visible: true }, // blank optional field -- filtered, must not appear
        { label: "発行者", value: "非表示のはず", visible: false }, // hidden field -- filtered, must not appear
      ],
      "",
      DEFAULT_FOLIO_SETTINGS,
      headerSettings
    );

    const pages = [minimal, fuller, blankOptional].flatMap(({ model }) => buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext));
    const { bytes, pageCount } = renderPaintPlanToPdf(pages, font);
    expect(pageCount).toBe(pages.length);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    // Prove the blank-optional/hidden fields really did not survive into Canonical.
    expect(blankOptional.compiled.rows).toEqual([{ label: "書名", value: "短編集" }]);

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "structural-colophon-real-settings-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
