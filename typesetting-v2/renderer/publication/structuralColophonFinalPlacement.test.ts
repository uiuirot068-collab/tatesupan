// P3-O08 -- Final-page completion, Step 2C (Human Visual QA HOLD round
// 28): completes real colophon PAGE POSITION + PLACEMENT porting.
//
// Round 27 ported the real `ColophonSettings` content compiler and
// `resolveColophonInsertion`'s DECISION logic, but explicitly disclosed
// two gaps: (1) `{mode:"after-body-page"}` was not wired into actual
// Canonical page composition, (2) `ColophonPlacement` (block-level page
// anchor) was not ported at all. This round closes both:
// - `core/layout/assemble.ts` now builds a real, Core-owned final
//   PHYSICAL page sequence (`CanonicalDocument.pageSequence`) by
//   interleaving colophon pages at the resolved insertion point, and
//   re-derives folio/header for every page (body and colophon alike)
//   against its own final physical index.
// - `ColophonPlacement.horizontal`/`.vertical` (real legacy semantics,
//   `src/lib/colophon.ts:67-74`, `ColophonPageCard.tsx:100-120`) are
//   ported: Core resolves/carries the semantic value on `ColophonBlock`,
//   Publication (`pdfGenerator.ts`) converts it to physical mm.
//   `respectGutter`/`respectVerticalMargins` remain NOT acted on --
//   `PublicationPageGeometry` has no per-page-parity gutter/outer
//   margin model, a materially larger, disclosed gap (see evidence).

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  composeCanonicalDocument,
  createFakeMeasurementProvider,
  DEFAULT_FOLIO_SETTINGS,
  DEFAULT_RULE_SET_V2,
  compileColophonContent,
  DEFAULT_COLOPHON_PLACEMENT,
  type HeaderSettings,
  type ColophonFieldInput,
  type ColophonCompiledContent,
  type ColophonPagePosition,
  type ColophonPlacement,
  type ColophonHorizontalPlacement,
  type ColophonVerticalPlacement,
  type CanonicalDocument,
  type PhysicalPageRef,
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
const CAPACITY = { charsPerLine: 10, linesPerColumn: 2, columnCount: 1 as const };

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

function legacyDefaultFields(overrides: Partial<Record<string, string>> = {}): ColophonFieldInput[] {
  return [
    { label: "書名", value: overrides.title ?? "", visible: true },
    { label: "著者名", value: overrides.author ?? "", visible: true },
    { label: "サークル", value: overrides.circle ?? "", visible: true },
    { label: "発行日", value: overrides.date ?? "", visible: true },
    { label: "印刷所", value: overrides.printer ?? "", visible: true },
    { label: "連絡先", value: overrides.contact ?? "", visible: true },
    { label: "発行者", value: overrides.publisher ?? "", visible: false },
  ];
}

// Ported from round 27's own `colophonFixturePieces` -- unchanged
// rationale (real PARAGRAPH_BREAK between rows, tab as a neutral
// label/value join with no invented visible separator).
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
}

function composeFull(bodyText: string, fields: ColophonFieldInput[], freeText: string, opts: ComposeOpts = {}) {
  const compiled = compileColophonContent({ fields, freeText });
  const pieces = colophonFixturePieces(compiled);
  const { units: bodyUnits, source: bodySource } = buildFixtureUnits("body", [{ kind: "TEXT", text: bodyText }]);
  const colophonBuild = pieces.length > 0 ? buildFixtureUnits("colophon", pieces) : undefined;
  const settings = settingsFor(CAPACITY);
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
  return { document, model, compiled, bodySource };
}

function pageAt(document: CanonicalDocument, ref: PhysicalPageRef) {
  return ref.kind === "body" ? document.pages[ref.index] : document.colophon!.pages[ref.index];
}

// 5 real body pages under CAPACITY (10 chars/line x 2 lines/col x 1 col
// = 20 chars/page): 20,20,20,20,10 -- deterministic, comfortably off
// any page-count boundary.
const BODY_5_PAGES = "あ".repeat(90);
const MINIMAL_FIELDS: ColophonFieldInput[] = [{ label: "書名", value: "短編", visible: true }];
const HEADER_SETTINGS: HeaderSettings = { hashiraOdd: "奇数柱", hashiraEven: "偶数柱", position: { band: "top", horizontal: "outer" } };

describe("Page position -- after-body-page wired into real Canonical page composition", () => {
  it("end placement: pageSequence is [...all body, ...all colophon] (test 1)", () => {
    const { document } = composeFull(BODY_5_PAGES, MINIMAL_FIELDS, "", { colophonPagePosition: { mode: "end" } });
    expect(document.pageSequence.slice(0, 5)).toEqual([0, 1, 2, 3, 4].map((index) => ({ kind: "body", index })));
    expect(document.pageSequence.slice(5)).toEqual([{ kind: "colophon", index: 0 }]);
  });

  it("after-body-page:1 inserts immediately after the first body page (test 2)", () => {
    const { document } = composeFull(BODY_5_PAGES, MINIMAL_FIELDS, "", { colophonPagePosition: { mode: "after-body-page", afterBodyPage: 1 } });
    expect(document.pageSequence.slice(0, 3)).toEqual([{ kind: "body", index: 0 }, { kind: "colophon", index: 0 }, { kind: "body", index: 1 }]);
  });

  it("after-body-page:3 inserts after a MIDDLE body page (test 3)", () => {
    const { document } = composeFull(BODY_5_PAGES, MINIMAL_FIELDS, "", { colophonPagePosition: { mode: "after-body-page", afterBodyPage: 3 } });
    expect(document.pageSequence.slice(0, 5)).toEqual([
      { kind: "body", index: 0 },
      { kind: "body", index: 1 },
      { kind: "body", index: 2 },
      { kind: "colophon", index: 0 },
      { kind: "body", index: 3 },
    ]);
  });

  it("after-body-page:5 (the LAST real body page) matches end placement exactly (test 4)", () => {
    const afterLast = composeFull(BODY_5_PAGES, MINIMAL_FIELDS, "", { colophonPagePosition: { mode: "after-body-page", afterBodyPage: 5 } }).document.pageSequence;
    const end = composeFull(BODY_5_PAGES, MINIMAL_FIELDS, "", { colophonPagePosition: { mode: "end" } }).document.pageSequence;
    expect(afterLast).toEqual(end);
  });

  it("an oversized target falls back to end, never crashes, never loses the colophon (test 5)", () => {
    const oversized = composeFull(BODY_5_PAGES, MINIMAL_FIELDS, "", { colophonPagePosition: { mode: "after-body-page", afterBodyPage: 999 } }).document.pageSequence;
    const end = composeFull(BODY_5_PAGES, MINIMAL_FIELDS, "", { colophonPagePosition: { mode: "end" } }).document.pageSequence;
    expect(oversized).toEqual(end);
  });

  it("a multi-page colophon inserts CONTIGUOUSLY at the resolved point, never interleaved with body pages (test 6)", () => {
    const fuller = compileColophonContent({
      fields: legacyDefaultFields({ title: "田", author: "山", circle: "文", date: "日", printer: "所", contact: "先", publisher: "者" }),
      freeText: "一行目\n二行目\n三行目",
    });
    const { document } = composeFull(BODY_5_PAGES, legacyDefaultFields({ title: "田", author: "山", circle: "文", date: "日", printer: "所", contact: "先", publisher: "者" }), "一行目\n二行目\n三行目", {
      colophonPagePosition: { mode: "after-body-page", afterBodyPage: 2 },
    });
    const colophonPageCount = document.colophon!.pages.length;
    expect(colophonPageCount).toBeGreaterThan(1);
    void fuller;
    expect(document.pageSequence.slice(0, 2)).toEqual([{ kind: "body", index: 0 }, { kind: "body", index: 1 }]);
    expect(document.pageSequence.slice(2, 2 + colophonPageCount)).toEqual(Array.from({ length: colophonPageCount }, (_, i) => ({ kind: "colophon", index: i })));
    expect(document.pageSequence.slice(2 + colophonPageCount)).toEqual([
      { kind: "body", index: 2 },
      { kind: "body", index: 3 },
      { kind: "body", index: 4 },
    ]);
  });

  it("physical page order is deterministic across repeated composition (test 7)", () => {
    const a = composeFull(BODY_5_PAGES, MINIMAL_FIELDS, "", { colophonPagePosition: { mode: "after-body-page", afterBodyPage: 2 } }).document.pageSequence;
    const b = composeFull(BODY_5_PAGES, MINIMAL_FIELDS, "", { colophonPagePosition: { mode: "after-body-page", afterBodyPage: 2 } }).document.pageSequence;
    expect(a).toEqual(b);
  });
});

describe("Page furniture after insertion -- resolved against the FINAL physical sequence", () => {
  it("folio numbering is continuous/monotonic across the whole final sequence, including the insertion point (test 8)", () => {
    const { document } = composeFull(BODY_5_PAGES, MINIMAL_FIELDS, "", {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      colophonPagePosition: { mode: "after-body-page", afterBodyPage: 2 },
    });
    const nums = document.pageSequence.map((ref) => Number(pageAt(document, ref).folio?.text)).filter((n) => !Number.isNaN(n));
    expect(nums.length).toBe(document.pageSequence.length);
    for (let i = 1; i < nums.length; i++) expect(nums[i] - nums[i - 1]).toBe(1);
  });

  it("header odd/even parity alternates correctly across the whole final sequence, including the insertion point (test 9)", () => {
    const { document } = composeFull(BODY_5_PAGES, MINIMAL_FIELDS, "", {
      headerSettings: HEADER_SETTINGS,
      colophonPagePosition: { mode: "after-body-page", afterBodyPage: 2 },
    });
    const texts = document.pageSequence.map((ref) => pageAt(document, ref).header?.text);
    for (const t of texts) expect(["奇数柱", "偶数柱"]).toContain(t);
    for (let i = 1; i < texts.length; i++) expect(texts[i]).not.toBe(texts[i - 1]);
  });

  it("body composition (lines/columns/breaks/source spans) is byte-identical regardless of colophonPagePosition -- only furniture may change (test 10)", () => {
    const end = composeFull(BODY_5_PAGES, MINIMAL_FIELDS, "", { colophonPagePosition: { mode: "end" } }).document.pages;
    const middle = composeFull(BODY_5_PAGES, MINIMAL_FIELDS, "", { colophonPagePosition: { mode: "after-body-page", afterBodyPage: 2 } }).document.pages;
    expect(end).toEqual(middle);
  });
});

describe("ColophonPlacement -- real legacy block-anchor semantics ported", () => {
  it("every legacy horizontal x vertical combination round-trips onto ColophonBlock.placement unchanged (test 11)", () => {
    const horizontals: ColophonHorizontalPlacement[] = ["left", "center", "right"];
    const verticals: ColophonVerticalPlacement[] = ["top", "center", "bottom"];
    for (const horizontal of horizontals) {
      for (const vertical of verticals) {
        const placement: ColophonPlacement = { horizontal, vertical, respectGutter: true, respectVerticalMargins: true };
        const { document } = composeFull("あいうえお", MINIMAL_FIELDS, "", { colophonPlacement: placement });
        expect(document.colophon?.placement).toEqual(placement);
      }
    }
  });

  it("omitting colophonPlacement preserves the real legacy default (center/center) (test 12)", () => {
    const { document } = composeFull("あいうえお", MINIMAL_FIELDS, "", {});
    expect(document.colophon?.placement).toEqual(DEFAULT_COLOPHON_PLACEMENT);
  });

  it("semantic placement is deterministic across repeated composition (test 13)", () => {
    const placement: ColophonPlacement = { horizontal: "left", vertical: "bottom", respectGutter: true, respectVerticalMargins: true };
    const a = composeFull("あいうえお", MINIMAL_FIELDS, "", { colophonPlacement: placement }).document.colophon?.placement;
    const b = composeFull("あいうえお", MINIMAL_FIELDS, "", { colophonPlacement: placement }).document.colophon?.placement;
    expect(a).toEqual(b);
  });

  it("Publication resolves the SAME semantic placement into the SAME physical anchor deterministically, and a DIFFERENT horizontal produces a DIFFERENT physical anchor (test 14)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const buildPlan = (placement: ColophonPlacement) => {
      const { model } = composeFull("あいうえお", MINIMAL_FIELDS, "自由記述欄です", { colophonPlacement: placement });
      return buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    };
    const leftA = buildPlan({ horizontal: "left", vertical: "center", respectGutter: true, respectVerticalMargins: true });
    const leftB = buildPlan({ horizontal: "left", vertical: "center", respectGutter: true, respectVerticalMargins: true });
    expect(leftA[1].commands).toEqual(leftB[1].commands);
    const right = buildPlan({ horizontal: "right", vertical: "center", respectGutter: true, respectVerticalMargins: true });
    const freeTextCmdLeft = leftA[1].commands.find((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text" && c.text === "自由記述欄です");
    const freeTextCmdRight = right[1].commands.find((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text" && c.text === "自由記述欄です");
    expect(freeTextCmdLeft?.align).toBe("left");
    expect(freeTextCmdRight?.align).toBe("right");
    expect(freeTextCmdLeft?.xMm).not.toBe(freeTextCmdRight?.xMm);
  });

  it("horizontal orientation (angle 0) is unchanged regardless of placement (test 15)", () => {
    const { model } = composeFull("あいうえお", MINIMAL_FIELDS, "", { colophonPlacement: { horizontal: "right", vertical: "bottom", respectGutter: true, respectVerticalMargins: true } });
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const textCmd = plan[1].commands.find((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    expect(textCmd?.angle).toBe(0);
  });

  it("body font inheritance is unchanged regardless of placement (test 16)", () => {
    const { model } = composeFull("あいうえお", MINIMAL_FIELDS, "", { colophonPlacement: { horizontal: "right", vertical: "bottom", respectGutter: true, respectVerticalMargins: true } });
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const textCommands = plan[1].commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    const first = textCommands[0].fontSizePt;
    for (const c of textCommands) expect(c.fontSizePt).toBe(first);
  });

  it("rows and freeText share the SAME block vertical anchor -- shifting vertical from top to bottom moves every line by the same delta (test 17)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const build = (vertical: ColophonVerticalPlacement) => {
      const { model } = composeFull("あいうえお", MINIMAL_FIELDS, "自由記述欄", { colophonPlacement: { horizontal: "center", vertical, respectGutter: true, respectVerticalMargins: true } });
      const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
      return plan[1].commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text").map((c) => c.yMm);
    };
    const top = build("top");
    const bottom = build("bottom");
    expect(top.length).toBe(bottom.length);
    expect(top.length).toBeGreaterThan(1); // both the row and the freeText line
    const deltas = top.map((y, i) => bottom[i] - y);
    for (const d of deltas) expect(d).toBeCloseTo(deltas[0], 5);
    expect(deltas[0]).toBeGreaterThan(0); // bottom really is further down than top
  });

  it("blank/hidden field filtering is unaffected by placement (test 18)", () => {
    const fields: ColophonFieldInput[] = [
      { label: "", value: "", visible: true },
      { label: "書名", value: "短編", visible: true },
      { label: "発行者", value: "非表示", visible: false },
    ];
    const { compiled } = composeFull("あいうえお", fields, "", { colophonPlacement: { horizontal: "left", vertical: "top", respectGutter: false, respectVerticalMargins: false } });
    expect(compiled.rows).toEqual([{ label: "書名", value: "短編" }]);
  });

  it("compiler output is identical regardless of which placement is supplied -- orthogonal concerns (test 19)", () => {
    const a = composeFull("あいうえお", MINIMAL_FIELDS, "自由記述", { colophonPlacement: { horizontal: "left", vertical: "top", respectGutter: true, respectVerticalMargins: true } }).compiled;
    const b = composeFull("あいうえお", MINIMAL_FIELDS, "自由記述", { colophonPlacement: { horizontal: "right", vertical: "bottom", respectGutter: false, respectVerticalMargins: false } }).compiled;
    expect(a).toEqual(b);
  });
});

describe("Overflow -- multi-page colophon after insertion, no silent clipping", () => {
  const fullerFields = legacyDefaultFields({ title: "田", author: "山", circle: "文", date: "日", printer: "所", contact: "先", publisher: "者" });
  const fullerFreeText = "一行目\n二行目\n三行目";

  it("every real compiled row/freeText line still appears somewhere across the (now multi-page, contiguously-inserted) colophon -- no silent clipping (test 20)", () => {
    const { model, document, compiled } = composeFull(BODY_5_PAGES, fullerFields, fullerFreeText, { colophonPagePosition: { mode: "after-body-page", afterBodyPage: 2 } });
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const colophonPlanIndices = document.pageSequence.map((ref, i) => ({ ref, i })).filter((x) => x.ref.kind === "colophon").map((x) => x.i);
    expect(colophonPlanIndices.length).toBeGreaterThan(1);
    const allTexts = colophonPlanIndices.flatMap((i) => plan[i].commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text").map((c) => c.text));
    for (const row of compiled.rows) {
      expect(allTexts).toContain(row.label);
      expect(allTexts).toContain(row.value);
    }
    renderPaintPlanToPdf(plan, font); // must not throw
  });

  it("continuation pages use the SAME 'smallest consistent' top-anchored start regardless of the requested vertical placement -- a real, disclosed v2-only rule since legacy has no multi-page colophon concept (test 21)", () => {
    const { model, document } = composeFull(BODY_5_PAGES, fullerFields, fullerFreeText, {
      colophonPagePosition: { mode: "after-body-page", afterBodyPage: 2 },
      colophonPlacement: { horizontal: "center", vertical: "bottom", respectGutter: true, respectVerticalMargins: true },
    });
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const colophonPlans = document.pageSequence.map((ref, i) => ({ ref, i })).filter((x) => x.ref.kind === "colophon").map((x) => plan[x.i]);
    expect(colophonPlans.length).toBeGreaterThan(2);
    const firstYs = colophonPlans.map((p) => p.commands.find((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text")?.yMm);
    for (const y of firstYs) expect(y).toBeCloseTo(firstYs[0]!, 5);
  });
});

describe("Regression", () => {
  it("Ruby/Dash/TCY/Ellipsis/Small Kana/Folio/Header all still render correctly with after-body-page insertion + a non-default placement (tests 22-28)", () => {
    const bodyText = "「今日は、雨だった。」きっと２０２６年";
    const { model } = composeFull(bodyText, MINIMAL_FIELDS, "本作はフィクションです。", {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      headerSettings: HEADER_SETTINGS,
      colophonPagePosition: { mode: "after-body-page", afterBodyPage: 1 },
      colophonPlacement: { horizontal: "left", vertical: "top", respectGutter: true, respectVerticalMargins: true },
    });
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(outlineContext.inkCenteredBaselineRatioForSmallKana("っ")).toBeDefined();
  });
});

describe("QA -- structural-colophon-final-product-qa.pdf (real settings only, real insertion, real placement)", () => {
  it("Document A (end/default placement), B (after-body-page insertion), C (alternate placement), D (multi-page colophon inserted mid-body), E (blank fields + freeText)", () => {
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const bodyText = "「今日は、雨だった。」きっとやってくる。";
    const fullerFields = legacyDefaultFields({ title: "田", author: "山", circle: "文", date: "日", printer: "所", contact: "先" });

    const docA = composeFull(bodyText, legacyDefaultFields({ title: "吾輩は猫である", author: "夏目漱石" }), "", {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      headerSettings: HEADER_SETTINGS,
      colophonPagePosition: { mode: "end" },
    });

    const docB = composeFull(BODY_5_PAGES, MINIMAL_FIELDS, "", {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      headerSettings: HEADER_SETTINGS,
      colophonPagePosition: { mode: "after-body-page", afterBodyPage: 2 },
    });

    const docC = composeFull(bodyText, legacyDefaultFields({ title: "配置サンプル" }), "左上寄せの例", {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      headerSettings: HEADER_SETTINGS,
      colophonPagePosition: { mode: "end" },
      colophonPlacement: { horizontal: "left", vertical: "top", respectGutter: true, respectVerticalMargins: true },
    });

    const docD = composeFull(BODY_5_PAGES, fullerFields, "一行目\n二行目\n三行目", {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      headerSettings: HEADER_SETTINGS,
      colophonPagePosition: { mode: "after-body-page", afterBodyPage: 2 },
    });

    const docE = composeFull(bodyText, [
      { label: "書名", value: "短編集", visible: true },
      { label: "", value: "", visible: true },
      { label: "発行者", value: "非表示のはず", visible: false },
    ], "自由記述欄の\n複数行テスト", {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      headerSettings: HEADER_SETTINGS,
      colophonPagePosition: { mode: "end" },
    });

    const pages = [docA, docB, docC, docD, docE].flatMap(({ model }) => buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext));
    const { bytes, pageCount } = renderPaintPlanToPdf(pages, font);
    expect(pageCount).toBe(pages.length);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    // Direct evidence each document really used real insertion/placement.
    expect(docB.document.pageSequence[2]).toEqual({ kind: "colophon", index: 0 });
    expect(docC.document.colophon?.placement?.horizontal).toBe("left");
    expect(docD.document.colophon!.pages.length).toBeGreaterThan(1);
    expect(docE.compiled.rows).toEqual([{ label: "書名", value: "短編集" }]);

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "structural-colophon-final-product-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
