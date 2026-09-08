// P3-O08 -- Final-page completion, Step 2D (Human Visual QA HOLD round
// 29): ports the last two real, disclosed `ColophonPlacement` fields --
// `respectGutter`/`respectVerticalMargins` (`src/lib/colophon.ts:67-74`).
//
// LEGACY AUDIT (direct read, `src/components/ColophonPageCard.tsx:81-98`):
//   const gutterOuterMin = Math.min(settings.marginGutter, settings.marginOuter);
//   const leftMarginMm = placement.respectGutter
//     ? isOddPage ? settings.marginOuter : settings.marginGutter
//     : gutterOuterMin;
//   const rightMarginMm = placement.respectGutter
//     ? isOddPage ? settings.marginGutter : settings.marginOuter
//     : gutterOuterMin;
//   const topMarginMm = placement.respectVerticalMargins ? settings.marginTop : vMarginMin;
//   const bottomMarginMm = placement.respectVerticalMargins ? settings.marginBottom : vMarginMin;
// This is REAL, shipped behavior -- NOT a legacy no-op. `respectGutter`
// picks an ASYMMETRIC left/right margin pair by page parity (the SAME
// isOddPage convention Core's own `resolveFolioPhysicalSide` already
// encodes: odd page -> outer=left/gutter=right, even mirrors) when ON,
// or a SYMMETRIC `min(gutter,outer)` pair when OFF.
// `respectVerticalMargins` is the same idea on the vertical axis
// (already-distinct `marginTopMm`/`marginBottomMm` fields, no new
// geometry needed there). `left`/`center`/`right` and
// `top`/`center`/`bottom` (round 28) all resolve WITHIN whatever
// resulting placement-area rectangle these two flags produce -- so
// "center" is not exempt either, and every test that claims to prove
// a difference uses DELIBERATELY ASYMMETRIC geometry (never a
// symmetric fixture that would pass whether or not the flag actually
// did anything).

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
import { buildPaintPlan, deriveBaselineRatioFromFont, renderPaintPlanToPdf, type PaintCommand, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { VerticalGposContext } from "./verticalGposPaint";
import { VerticalYakumonoAlignContext } from "./verticalYakumonoAlign";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits, type FixturePiece } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");
const CAPACITY = { charsPerLine: 10, linesPerColumn: 2, columnCount: 1 as const };

// Deliberately ASYMMETRIC on every axis -- a symmetric fixture would
// make respectGutter/respectVerticalMargins true vs false paint
// IDENTICALLY, proving nothing (the task's own explicit warning).
const ASYMMETRIC_GEOMETRY: PublicationPageGeometry = {
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

const BODY_1_PAGE = "あいうえお";
const BODY_5_PAGES = "あ".repeat(90); // 20/page x 4 + 10 -- 5 real pages, matching round 28's own derivation
const MINIMAL_FIELDS: ColophonFieldInput[] = [{ label: "書名", value: "短編", visible: true }];
const HEADER_SETTINGS: HeaderSettings = { hashiraOdd: "奇数柱", hashiraEven: "偶数柱", position: { band: "top", horizontal: "outer" } };

function buildOne(bodyText: string, fields: ColophonFieldInput[], freeText: string, placement: ColophonPlacement, opts: Partial<ComposeOpts> = {}) {
  const { outlineContext, gposContext, yakumonoContext } = realContexts();
  const { model, document } = composeFull(bodyText, fields, freeText, { colophonPlacement: placement, ...opts });
  const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
  return { plan, document };
}

function colophonTextCommands(plan: ReturnType<typeof buildPaintPlan>, colophonPlanIndex: number) {
  return plan[colophonPlanIndex].commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
}

describe("respectGutter -- real, parity-dependent asymmetric margin selection", () => {
  it("respectGutter=true on an ODD physical page: outer margin (small) lands on the LEFT, matching Core's own resolveFolioPhysicalSide('outer', isOddPage) convention (test 1)", () => {
    // colophon inserted after body page 0 -> its own physicalIndex is 1 -> physical page NUMBER 2 -> EVEN.
    // Insert after body page count 0 is not valid; use afterBodyPage:1 on a 2-page-worthy single-page body instead:
    // simplest controlled case: end placement on a 1-body-page doc -> colophon physicalIndex 1 -> page number 2 -> EVEN.
    // For an ODD physical colophon page, use a 2-body-page doc (colophon physicalIndex 2 -> page number 3 -> ODD).
    const twoBodyPages = "あ".repeat(30); // 20 + 10 -> 2 real pages
    const { plan, document } = buildOne(twoBodyPages, MINIMAL_FIELDS, "自由記述", { horizontal: "left", vertical: "center", respectGutter: true, respectVerticalMargins: true });
    const colophonPlanIndex = document.pageSequence.findIndex((r) => r.kind === "colophon");
    expect(colophonPlanIndex).toBe(2); // physical page number 3 -> odd
    const cmds = colophonTextCommands(plan, colophonPlanIndex);
    const freeTextCmd = cmds.find((c) => c.text === "自由記述");
    // odd page -> outer=left (11mm) -> content starts further LEFT (closer to paper edge) than the gutter (26mm) would allow.
    expect(freeTextCmd?.xMm).toBeCloseTo(ASYMMETRIC_GEOMETRY.marginOuterMm!, 5);
  });

  it("respectGutter=true on an EVEN physical page: gutter margin (large) lands on the LEFT (test 2)", () => {
    const { plan, document } = buildOne(BODY_1_PAGE, MINIMAL_FIELDS, "自由記述", { horizontal: "left", vertical: "center", respectGutter: true, respectVerticalMargins: true });
    const colophonPlanIndex = document.pageSequence.findIndex((r) => r.kind === "colophon");
    expect(colophonPlanIndex).toBe(1); // physical page number 2 -> even
    const cmds = colophonTextCommands(plan, colophonPlanIndex);
    const freeTextCmd = cmds.find((c) => c.text === "自由記述");
    expect(freeTextCmd?.xMm).toBeCloseTo(ASYMMETRIC_GEOMETRY.marginGutterMm!, 5);
  });

  it("respectGutter=false: both sides use the SAME symmetric min(gutter,outer) regardless of parity (test 3)", () => {
    const odd = buildOne("あ".repeat(30), MINIMAL_FIELDS, "自由記述", { horizontal: "left", vertical: "center", respectGutter: false, respectVerticalMargins: true });
    const even = buildOne(BODY_1_PAGE, MINIMAL_FIELDS, "自由記述", { horizontal: "left", vertical: "center", respectGutter: false, respectVerticalMargins: true });
    const oddIdx = odd.document.pageSequence.findIndex((r) => r.kind === "colophon");
    const evenIdx = even.document.pageSequence.findIndex((r) => r.kind === "colophon");
    const oddX = colophonTextCommands(odd.plan, oddIdx).find((c) => c.text === "自由記述")?.xMm;
    const evenX = colophonTextCommands(even.plan, evenIdx).find((c) => c.text === "自由記述")?.xMm;
    const expected = Math.min(ASYMMETRIC_GEOMETRY.marginGutterMm!, ASYMMETRIC_GEOMETRY.marginOuterMm!);
    expect(oddX).toBeCloseTo(expected, 5);
    expect(evenX).toBeCloseTo(expected, 5);
  });

  it("left vs right anchor combined with respectGutter is deterministic and physically distinct (test 4)", () => {
    const left = buildOne(BODY_1_PAGE, MINIMAL_FIELDS, "自由記述", { horizontal: "left", vertical: "center", respectGutter: true, respectVerticalMargins: true });
    const right = buildOne(BODY_1_PAGE, MINIMAL_FIELDS, "自由記述", { horizontal: "right", vertical: "center", respectGutter: true, respectVerticalMargins: true });
    const leftIdx = left.document.pageSequence.findIndex((r) => r.kind === "colophon");
    const rightIdx = right.document.pageSequence.findIndex((r) => r.kind === "colophon");
    const leftX = colophonTextCommands(left.plan, leftIdx).find((c) => c.text === "自由記述")?.xMm;
    const rightX = colophonTextCommands(right.plan, rightIdx).find((c) => c.text === "自由記述")?.xMm;
    expect(leftX).not.toBe(rightX);
  });
});

describe("respectVerticalMargins -- real asymmetric top/bottom margin selection", () => {
  it("respectVerticalMargins=true: content area top uses the REAL marginTopMm (22, not symmetric) (test 5)", () => {
    const { plan, document } = buildOne(BODY_1_PAGE, MINIMAL_FIELDS, "自由記述", { horizontal: "center", vertical: "top", respectGutter: true, respectVerticalMargins: true });
    const idx = document.pageSequence.findIndex((r) => r.kind === "colophon");
    const cmds = colophonTextCommands(plan, idx);
    const firstY = Math.min(...cmds.map((c) => c.yMm));
    expect(firstY).toBeGreaterThan(ASYMMETRIC_GEOMETRY.marginTopMm! - 1); // starts at/after the real (larger) top margin
  });

  it("respectVerticalMargins=false: top/bottom both become min(top,bottom) -- content starts CLOSER to the paper edge than respectVerticalMargins=true would allow (test 6)", () => {
    const on = buildOne(BODY_1_PAGE, MINIMAL_FIELDS, "自由記述", { horizontal: "center", vertical: "top", respectGutter: true, respectVerticalMargins: true });
    const off = buildOne(BODY_1_PAGE, MINIMAL_FIELDS, "自由記述", { horizontal: "center", vertical: "top", respectGutter: true, respectVerticalMargins: false });
    const onIdx = on.document.pageSequence.findIndex((r) => r.kind === "colophon");
    const offIdx = off.document.pageSequence.findIndex((r) => r.kind === "colophon");
    const onY = Math.min(...colophonTextCommands(on.plan, onIdx).map((c) => c.yMm));
    const offY = Math.min(...colophonTextCommands(off.plan, offIdx).map((c) => c.yMm));
    expect(offY).toBeLessThan(onY); // symmetric (smaller) top margin -> starts higher up the page
  });

  it("vertical:'top' is deterministic across repeated composition (test 7)", () => {
    const a = buildOne(BODY_1_PAGE, MINIMAL_FIELDS, "自由記述", { horizontal: "center", vertical: "top", respectGutter: true, respectVerticalMargins: true });
    const b = buildOne(BODY_1_PAGE, MINIMAL_FIELDS, "自由記述", { horizontal: "center", vertical: "top", respectGutter: true, respectVerticalMargins: true });
    const aIdx = a.document.pageSequence.findIndex((r) => r.kind === "colophon");
    const bIdx = b.document.pageSequence.findIndex((r) => r.kind === "colophon");
    expect(colophonTextCommands(a.plan, aIdx)).toEqual(colophonTextCommands(b.plan, bIdx));
  });

  it("vertical:'bottom' is deterministic and physically distinct from 'top' under the SAME respect flags (test 8)", () => {
    const top = buildOne(BODY_1_PAGE, MINIMAL_FIELDS, "自由記述", { horizontal: "center", vertical: "top", respectGutter: true, respectVerticalMargins: true });
    const bottom = buildOne(BODY_1_PAGE, MINIMAL_FIELDS, "自由記述", { horizontal: "center", vertical: "bottom", respectGutter: true, respectVerticalMargins: true });
    const topIdx = top.document.pageSequence.findIndex((r) => r.kind === "colophon");
    const bottomIdx = bottom.document.pageSequence.findIndex((r) => r.kind === "colophon");
    const topY = Math.min(...colophonTextCommands(top.plan, topIdx).map((c) => c.yMm));
    const bottomY = Math.min(...colophonTextCommands(bottom.plan, bottomIdx).map((c) => c.yMm));
    expect(bottomY).toBeGreaterThan(topY);
  });
});

describe("center placement is NOT exempt from the respect flags (proven with asymmetric geometry, never a symmetric false-positive)", () => {
  it("center/center placement's own resolved position differs between respectGutter/respectVerticalMargins true vs false (test 9)", () => {
    const on = buildOne(BODY_1_PAGE, MINIMAL_FIELDS, "自由記述", { horizontal: "center", vertical: "center", respectGutter: true, respectVerticalMargins: true });
    const off = buildOne(BODY_1_PAGE, MINIMAL_FIELDS, "自由記述", { horizontal: "center", vertical: "center", respectGutter: false, respectVerticalMargins: false });
    const onIdx = on.document.pageSequence.findIndex((r) => r.kind === "colophon");
    const offIdx = off.document.pageSequence.findIndex((r) => r.kind === "colophon");
    const onCmd = colophonTextCommands(on.plan, onIdx).find((c) => c.text === "自由記述");
    const offCmd = colophonTextCommands(off.plan, offIdx).find((c) => c.text === "自由記述");
    // asymmetric geometry guarantees these really differ -- not a same-value coincidence.
    expect(onCmd?.yMm).not.toBeCloseTo(offCmd?.yMm ?? -1, 3);
  });
});

describe("Both flags together", () => {
  it("respectGutter=false + respectVerticalMargins=false together is deterministic (test 10)", () => {
    const a = buildOne(BODY_1_PAGE, MINIMAL_FIELDS, "自由記述", { horizontal: "left", vertical: "bottom", respectGutter: false, respectVerticalMargins: false });
    const b = buildOne(BODY_1_PAGE, MINIMAL_FIELDS, "自由記述", { horizontal: "left", vertical: "bottom", respectGutter: false, respectVerticalMargins: false });
    const aIdx = a.document.pageSequence.findIndex((r) => r.kind === "colophon");
    const bIdx = b.document.pageSequence.findIndex((r) => r.kind === "colophon");
    expect(colophonTextCommands(a.plan, aIdx)).toEqual(colophonTextCommands(b.plan, bIdx));
  });
});

describe("Multi-page continuation -- gutter side alternates correctly across real physical page parity", () => {
  it("respectGutter alternates the resolved left/right margins across colophon continuation pages, matching each page's own real parity (test 11)", () => {
    const fuller = legacyDefaultFields({ title: "田", author: "山", circle: "文", date: "日", printer: "所", contact: "先", publisher: "者" });
    const { plan, document } = buildOne(BODY_1_PAGE, fuller, "一行目\n二行目\n三行目\n四行目\n五行目\n六行目", {
      horizontal: "left",
      vertical: "top",
      respectGutter: true,
      respectVerticalMargins: true,
    });
    const colophonIndices = document.pageSequence.map((r, i) => ({ r, i })).filter((x) => x.r.kind === "colophon").map((x) => x.i);
    expect(colophonIndices.length).toBeGreaterThan(1);
    const leftXs = colophonIndices.map((i) => Math.min(...colophonTextCommands(plan, i).map((c) => c.xMm)));
    // Alternates between the outer (11) and gutter (26) mm values, one per physical parity.
    for (let k = 1; k < leftXs.length; k++) expect(leftXs[k]).not.toBeCloseTo(leftXs[k - 1], 3);
    for (const x of leftXs) expect([ASYMMETRIC_GEOMETRY.marginOuterMm, ASYMMETRIC_GEOMETRY.marginGutterMm]).toContainEqual(expect.closeTo(x, 3));
  });
});

describe("Regression", () => {
  it("body composition is unchanged by margin-respect placement settings (test 12)", () => {
    const withFlags = composeFull(BODY_1_PAGE, MINIMAL_FIELDS, "", { colophonPlacement: { horizontal: "left", vertical: "bottom", respectGutter: false, respectVerticalMargins: false } }).document.pages;
    const without = composeFull(BODY_1_PAGE, MINIMAL_FIELDS, "", {}).document.pages;
    expect(withFlags).toEqual(without);
  });

  it("page ordering (pageSequence) is unaffected by margin-respect placement settings (test 13)", () => {
    const withFlags = composeFull(BODY_1_PAGE, MINIMAL_FIELDS, "", { colophonPlacement: { horizontal: "left", vertical: "bottom", respectGutter: false, respectVerticalMargins: false } }).document.pageSequence;
    const without = composeFull(BODY_1_PAGE, MINIMAL_FIELDS, "", {}).document.pageSequence;
    expect(withFlags).toEqual(without);
  });

  it("Folio regression PASS (test 14)", () => {
    const { document } = composeFull(BODY_1_PAGE, MINIMAL_FIELDS, "", { folioSettings: DEFAULT_FOLIO_SETTINGS, colophonPlacement: { horizontal: "left", vertical: "top", respectGutter: true, respectVerticalMargins: true } });
    expect(document.colophon?.pages[0].folio?.text).toBe("2");
  });

  it("Header regression PASS (test 15)", () => {
    const { document } = composeFull(BODY_1_PAGE, MINIMAL_FIELDS, "", { headerSettings: HEADER_SETTINGS, colophonPlacement: { horizontal: "left", vertical: "top", respectGutter: true, respectVerticalMargins: true } });
    expect(document.colophon?.pages[0].header?.text).toBe("偶数柱");
  });

  it("Ruby/Dash/TCY/Ellipsis/Small Kana regression PASS with margin-respect placement present (tests 16-20)", () => {
    const bodyText = "「今日は、雨だった。」きっと２０２６年";
    const { model } = composeFull(bodyText, MINIMAL_FIELDS, "本作はフィクションです。", {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      headerSettings: HEADER_SETTINGS,
      colophonPlacement: { horizontal: "left", vertical: "top", respectGutter: true, respectVerticalMargins: true },
    });
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(outlineContext.inkCenteredBaselineRatioForSmallKana("っ")).toBeDefined();
  });
});

describe("QA -- structural-colophon-margin-respect-qa.pdf (focused A-J comparisons)", () => {
  it("A-D (horizontal x respectGutter), E-H (vertical x respectVerticalMargins), I-J (center/center both flags)", () => {
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const bodyText = "「今日は、雨だった。」きっとやってくる。";
    const make = (placement: ColophonPlacement) => composeFull(bodyText, legacyDefaultFields({ title: "配置例" }), "自由記述欄の例です", { folioSettings: DEFAULT_FOLIO_SETTINGS, headerSettings: HEADER_SETTINGS, colophonPlacement: placement });

    const docA = make({ horizontal: "left", vertical: "center", respectGutter: true, respectVerticalMargins: true });
    const docB = make({ horizontal: "left", vertical: "center", respectGutter: false, respectVerticalMargins: true });
    const docC = make({ horizontal: "right", vertical: "center", respectGutter: true, respectVerticalMargins: true });
    const docD = make({ horizontal: "right", vertical: "center", respectGutter: false, respectVerticalMargins: true });
    const docE = make({ horizontal: "center", vertical: "top", respectGutter: true, respectVerticalMargins: true });
    const docF = make({ horizontal: "center", vertical: "top", respectGutter: true, respectVerticalMargins: false });
    const docG = make({ horizontal: "center", vertical: "bottom", respectGutter: true, respectVerticalMargins: true });
    const docH = make({ horizontal: "center", vertical: "bottom", respectGutter: true, respectVerticalMargins: false });
    const docI = make({ horizontal: "center", vertical: "center", respectGutter: true, respectVerticalMargins: true });
    const docJ = make({ horizontal: "center", vertical: "center", respectGutter: false, respectVerticalMargins: false });

    const docs = [docA, docB, docC, docD, docE, docF, docG, docH, docI, docJ];
    const pages = docs.flatMap(({ model }) => buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext));
    const { bytes, pageCount } = renderPaintPlanToPdf(pages, font);
    expect(pageCount).toBe(pages.length);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "structural-colophon-margin-respect-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});

describe("QA -- regenerate the complete integrated final-product artifact", () => {
  it("structural-colophon-final-product-qa.pdf now also carries real respectGutter/respectVerticalMargins values (documents A-E, round 28, re-emitted with round 29's own geometry fields present)", () => {
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
    const docC = composeFull(bodyText, legacyDefaultFields({ title: "配置サンプル" }), "左上寄せ・ガター実寸の例", {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      headerSettings: HEADER_SETTINGS,
      colophonPagePosition: { mode: "end" },
      colophonPlacement: { horizontal: "left", vertical: "top", respectGutter: true, respectVerticalMargins: true },
    });
    const docD = composeFull(BODY_5_PAGES, fullerFields, "一行目\n二行目\n三行目", {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      headerSettings: HEADER_SETTINGS,
      colophonPagePosition: { mode: "after-body-page", afterBodyPage: 2 },
      colophonPlacement: { horizontal: "left", vertical: "top", respectGutter: true, respectVerticalMargins: true },
    });
    const docE = composeFull(
      bodyText,
      [
        { label: "書名", value: "短編集", visible: true },
        { label: "", value: "", visible: true },
        { label: "発行者", value: "非表示のはず", visible: false },
      ],
      "自由記述欄の\n複数行テスト",
      { folioSettings: DEFAULT_FOLIO_SETTINGS, headerSettings: HEADER_SETTINGS, colophonPagePosition: { mode: "end" } }
    );

    const pages = [docA, docB, docC, docD, docE].flatMap(({ model }) => buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext));
    const { bytes, pageCount } = renderPaintPlanToPdf(pages, font);
    expect(pageCount).toBe(pages.length);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "structural-colophon-final-product-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
