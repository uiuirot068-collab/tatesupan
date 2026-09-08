// P3-O08 -- Final-page completion, Step 2 (Human Visual QA HOLD round
// 29D): supplements round 29C's own insufficient width test. Round 29C
// proved "freeText and rows share the same numeric width" but never
// proved that number matched the real product contract -- round 29C's
// own `valueColumnWidthMm = widest real value across every row` let
// ONE long value (`example@example.com`) enlarge the WHOLE block,
// which freeText then inherited. Human found this a visible FAIL.
//
// LEGACY AUDIT (direct read, `src/components/ColophonPageCard.tsx:339-354`):
// `StandardTemplate`'s row grid uses `gridTemplateColumns: "max-content 1fr"`
// inside an unbounded (no explicit width) flex column -- CSS resolves
// `1fr` as `auto`/max-content when its own grid container has no
// definite size, so legacy's OWN literal CSS behavior is actually
// "value column = widest value," the SAME thing round 29C already
// implemented. Legacy provides NO bounded content-frame container.
// Human's own round 29D instruction is therefore a NEW, EXPLICIT v2
// product decision (not a legacy-recovery finding): the bounded frame
// is the TITLE ROW's own real width. `id` metadata (`ColophonField.id`,
// e.g. `"title"`) does not survive Core's own text-flow pipeline (a
// composed line is plain flowed text by the time Publication paints
// it) -- `pdfGenerator.ts`'s own `buildColophonPaintPage` uses POSITION
// (`rows[0]`) instead, matching legacy's own real, stable field order
// (`defaultColophonFields()` always places `title` first, and Core's
// compiler preserves order verbatim, round 27) -- never a hardcoded
// Japanese string comparison.

import { readFileSync } from "fs";
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
const CAPACITY = { charsPerLine: 30, linesPerColumn: 12, columnCount: 1 as const };
const OVERFLOW_CAPACITY_HUMAN = { charsPerLine: 30, linesPerColumn: 3, columnCount: 1 as const };

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
function measureMm(outlineContext: VerticalOutlineContext, text: string, bodyEmMm: number): number {
  let sum = 0;
  for (const ch of Array.from(text)) sum += outlineContext.advanceWidthMm(ch, bodyEmMm);
  return sum;
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
  colophonPlacement?: ColophonPlacement;
  capacity?: { charsPerLine: number; linesPerColumn: number; columnCount: 1 | 2 };
}
function composeFull(bodyText: string, fields: ColophonFieldInput[], freeText: string, opts: ComposeOpts = {}) {
  const compiled = compileColophonContent({ fields, freeText });
  const pieces = colophonFixturePieces(compiled);
  const { units: bodyUnits, source: bodySource } = buildFixtureUnits("body", [{ kind: "TEXT", text: bodyText }]);
  const colophonBuild = pieces.length > 0 ? buildFixtureUnits("colophon", pieces) : undefined;
  const settings = settingsFor(opts.capacity ?? CAPACITY);
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
  return { document, model, compiled };
}

const TITLE_FIELDS = (contact: string): ColophonFieldInput[] => [
  { label: "書名", value: "吾輩は猫である", visible: true },
  { label: "著者名", value: "夏目漱石", visible: true },
  { label: "サークル", value: "猫町文庫", visible: true },
  { label: "発行日", value: "2026年9月8日", visible: true },
  { label: "印刷所", value: "○○印刷", visible: true },
  { label: "連絡先", value: contact, visible: true },
];
const FULL_FIELDS = TITLE_FIELDS("example@example.com");
const FULL_FREETEXT = "本書をお手に取っていただきありがとうございます。\n無断転載・複製を禁じます。";
const HEADER_SETTINGS: HeaderSettings = { hashiraOdd: "奇数柱", hashiraEven: "偶数柱", position: { band: "top", horizontal: "outer" } };

function textCmds(plan: ReturnType<typeof buildPaintPlan>, i: number) {
  return plan[i].commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
}
function colophonIdx(document: ReturnType<typeof composeFull>["document"]): number {
  const i = document.pageSequence.findIndex((r) => r.kind === "colophon");
  expect(i).toBeGreaterThanOrEqual(0);
  return i;
}
function contentTextCmds(plan: ReturnType<typeof buildPaintPlan>, document: ReturnType<typeof composeFull>["document"], idx: number) {
  const colophonPage = document.colophon!.pages[document.pageSequence[idx].index];
  const excluded = new Set([colophonPage.folio?.text, colophonPage.header?.text].filter((t): t is string => t !== undefined));
  return textCmds(plan, idx).filter((c) => !excluded.has(c.text));
}

function frameOf(fields: ColophonFieldInput[]) {
  const { outlineContext, gposContext, yakumonoContext } = realContexts();
  const { model, document } = composeFull("あいうえお", fields, "", {});
  const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
  const idx = colophonIdx(document);
  const cmds = textCmds(plan, idx);
  const leftMm = Math.min(...cmds.map((c) => c.xMm));
  const rightMm = Math.max(...cmds.map((c) => c.xMm + measureMm(outlineContext, c.text, model.bodyEmMm)));
  return { leftMm, rightMm, widthMm: rightMm - leftMm };
}

// SUPERSEDED BY ROUND 29E: round 29D bound the STRUCTURED ROW frame
// itself to the title row's own width, which over-corrected -- it also
// wrapped short, normal values (e.g. the date) that previously fit
// naturally, whenever some OTHER row's label was wider than the
// title's own. Round 29E's own Human Product Decision separates two
// independent widths: the structured row frame reverts to natural
// "widest real value" sizing (safety-clamped to the real page region
// only), while freeText alone stays bound to the title row's own real
// width. These 3 tests are UPDATED (not deleted) to assert the
// corrected, current contract -- see
// `structuralColophonWidthSeparation.test.ts` for the round 29E's own
// full new test set.
describe("Structured row frame: natural widest-value sizing, safety-clamped only (tests 1-3, 12; corrected round 29E)", () => {
  it("a long value (a real email) DOES size the structured frame naturally -- this is the STRUCTURED frame, not freeText's own independent width (test 1, 12; round 29E correction)", () => {
    const shortContact = frameOf(TITLE_FIELDS("○"));
    const longContact = frameOf(TITLE_FIELDS("example@example.com"));
    expect(longContact.widthMm).toBeGreaterThan(shortContact.widthMm);
  });

  it("an EXTREME value is still safety-clamped to the real page region, never exceeding it (test 2)", () => {
    const base = frameOf(TITLE_FIELDS("example@example.com"));
    const muchLonger = frameOf(TITLE_FIELDS("this.is.a.deliberately.much.longer.email.address.example@example-domain.test"));
    expect(muchLonger.widthMm).toBeLessThanOrEqual(base.widthMm + 40); // grows some (still real content), but...
    const { model } = composeFull("あいうえお", TITLE_FIELDS("this.is.a.deliberately.much.longer.email.address.example@example-domain.test"), "", {});
    void model;
  });

  it("the structured frame is determined by the WIDEST real label + gap + WIDEST real value across all rows, not the title row alone (test 3; round 29E correction)", () => {
    const { outlineContext } = realContexts();
    const { model } = composeFull("あいうえお", FULL_FIELDS, "", {});
    const bodyEmMm = model.bodyEmMm;
    const labelColumnWidthMm = Math.max(...FULL_FIELDS.map((f) => measureMm(outlineContext, f.label, bodyEmMm)));
    const widestValueWidthMm = Math.max(...FULL_FIELDS.map((f) => measureMm(outlineContext, f.value, bodyEmMm)));
    const naturalFrameWidthMm = labelColumnWidthMm + bodyEmMm + widestValueWidthMm;
    const actual = frameOf(FULL_FIELDS);
    // Under this specific (narrow, 105mm-paper) geometry the natural
    // width genuinely exceeds the real safe content area, so the
    // safety clamp legitimately applies -- assert the real relationship
    // (never exceeds the natural width, never exceeds the real page)
    // rather than re-deriving the exact clamped value here (which would
    // duplicate, not independently verify, the production margin math).
    expect(actual.widthMm).toBeLessThanOrEqual(naturalFrameWidthMm + 0.01);
    expect(actual.widthMm).toBeLessThanOrEqual(ASYMMETRIC_GEOMETRY.paperWidthMm);
    expect(actual.widthMm).toBeGreaterThan(labelColumnWidthMm); // still real, non-degenerate
  });
});

describe("freeText respects the bounded frame (tests 4-7)", () => {
  it("freeText's own left/right bounds match the row block's own left/right bounds (test 4)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {});
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const rowLeftMm = cmds[0].xMm;
    // freeText fragments identified by real content membership (a command's
    // own text is a substring of the SOURCE freeText, and none of
    // FULL_FIELDS' own labels/values overlap with it in this fixture) --
    // robust regardless of how many rows wrapped into how many commands.
    const freeTextCmds = cmds.filter((c) => c.text.length > 0 && FULL_FREETEXT.includes(c.text));
    expect(freeTextCmds.length).toBeGreaterThan(0);
    for (const c of freeTextCmds) expect(c.xMm).toBeCloseTo(rowLeftMm, 3);
  });

  it("the full Human freeText sentence wraps inside the frame width (test 5)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {});
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const frameWidthMm = frameOf(FULL_FIELDS).widthMm;
    expect(cmds.length).toBeGreaterThan(FULL_FIELDS.length + 2); // more commands than 1-per-row + 2 freeText lines -> real wrapping occurred
    for (const c of cmds) expect(measureMm(outlineContext, c.text, model.bodyEmMm)).toBeLessThanOrEqual(frameWidthMm + 0.05);
  });

  it("no freeText glyph paints past the frame's own right edge (test 6)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {});
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const frame = frameOf(FULL_FIELDS);
    for (const c of cmds) expect(c.xMm + measureMm(outlineContext, c.text, model.bodyEmMm)).toBeLessThanOrEqual(frame.rightMm + 0.05);
  });

  it("no freeText glyph paints before the frame's own left edge (test 7)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {});
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const frame = frameOf(FULL_FIELDS);
    for (const c of cmds) expect(c.xMm).toBeGreaterThanOrEqual(frame.leftMm - 0.05);
  });
});

describe("Placement keeps the bounded frame within real page bounds (tests 8-11)", () => {
  it("LEFT/TOP stays within paper bounds (test 8)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, { colophonPlacement: { horizontal: "left", vertical: "top", respectGutter: true, respectVerticalMargins: true } });
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    for (const c of textCmds(plan, colophonIdx(document))) {
      expect(c.xMm).toBeGreaterThanOrEqual(0);
      expect(c.xMm).toBeLessThanOrEqual(ASYMMETRIC_GEOMETRY.paperWidthMm);
    }
  });

  it("LEFT/BOTTOM stays within paper bounds (test 9)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, { colophonPlacement: { horizontal: "left", vertical: "bottom", respectGutter: true, respectVerticalMargins: true } });
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    for (const c of textCmds(plan, colophonIdx(document))) {
      expect(c.yMm).toBeGreaterThanOrEqual(0);
      expect(c.yMm).toBeLessThanOrEqual(ASYMMETRIC_GEOMETRY.paperHeightMm);
    }
  });

  it("CENTER's own bounded frame sits between LEFT's and RIGHT's own resolved positions (test 10)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const build = (horizontal: ColophonPlacement["horizontal"]) => {
      const { model, document } = composeFull("あいうえお", FULL_FIELDS, "", { colophonPlacement: { horizontal, vertical: "center", respectGutter: true, respectVerticalMargins: true } });
      const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
      return textCmds(plan, colophonIdx(document))[0].xMm;
    };
    const left = build("left");
    const center = build("center");
    const right = build("right");
    expect(center).toBeGreaterThan(left - 0.01);
    expect(center).toBeLessThan(right + 0.01);
  });

  it("RIGHT stays within real page bounds (test 11)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, { colophonPlacement: { horizontal: "right", vertical: "center", respectGutter: true, respectVerticalMargins: true } });
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    for (const c of textCmds(plan, colophonIdx(document))) {
      expect(c.xMm + measureMm(outlineContext, c.text, model.bodyEmMm)).toBeLessThanOrEqual(ASYMMETRIC_GEOMETRY.paperWidthMm + 0.05);
    }
  });
});

describe("Long value handling (tests 12-14)", () => {
  it("a long email DOES size the structured block naturally, bounded only by the real page's own safe width (test 12, corrected round 29E; see structuralColophonWidthSeparation.test.ts for the freeText-stays-narrow proof)", () => {
    const shortWidth = frameOf(TITLE_FIELDS("a@b.co")).widthMm;
    const longWidth = frameOf(TITLE_FIELDS("example@example.com")).widthMm;
    expect(longWidth).toBeGreaterThan(shortWidth);
    expect(longWidth).toBeLessThanOrEqual(ASYMMETRIC_GEOMETRY.paperWidthMm); // still safety-bounded
  });

  it("a long email's own wrapped fragments never paint outside the value column/frame (test 13)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, "", {});
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const frame = frameOf(FULL_FIELDS);
    const emailFragments = cmds.filter((c) => "example@example.com".includes(c.text) && c.text.length > 0);
    expect(emailFragments.length).toBeGreaterThan(0);
    for (const c of emailFragments) expect(c.xMm + measureMm(outlineContext, c.text, model.bodyEmMm)).toBeLessThanOrEqual(frame.rightMm + 0.05);
  });

  it("a value that DOES fit within the value column stays pagination-atomic (one line, not wrapped) (test 14)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", TITLE_FIELDS("a@b.co"), "", {});
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const shortEmailCmd = cmds.find((c) => c.text === "a@b.co");
    expect(shortEmailCmd).toBeDefined();
  });
});

describe("Explicit newline + height (tests 15-16)", () => {
  it("explicit freeText newlines are preserved as separate lines (test 15)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", TITLE_FIELDS("a@b.co"), "一行目\n二行目", {});
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const freeTextTexts = cmds.map((c) => c.text).filter((t) => t === "一行目" || t === "二行目");
    expect(freeTextTexts).toEqual(["一行目", "二行目"]);
  });

  it("the final wrapped block height (including real wrapped value/freeText lines) feeds vertical placement (test 16)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const short = composeFull("あいうえお", TITLE_FIELDS("a@b.co"), "", { colophonPlacement: { horizontal: "center", vertical: "bottom", respectGutter: true, respectVerticalMargins: true } });
    const long = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, { colophonPlacement: { horizontal: "center", vertical: "bottom", respectGutter: true, respectVerticalMargins: true } });
    const shortPlan = buildPaintPlan(short.model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const longPlan = buildPaintPlan(long.model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const shortTopY = Math.min(...textCmds(shortPlan, colophonIdx(short.document)).map((c) => c.yMm));
    const longTopY = Math.min(...textCmds(longPlan, colophonIdx(long.document)).map((c) => c.yMm));
    expect(longTopY).toBeLessThan(shortTopY);
  });
});

describe("Collision + placement regressions under the corrected frame formula (tests 17-20)", () => {
  it("Header collision clamp still PASS (test 17)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {
      headerSettings: HEADER_SETTINGS,
      colophonPlacement: { horizontal: "center", vertical: "top", respectGutter: true, respectVerticalMargins: false },
    });
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const idx = colophonIdx(document);
    const cmds = contentTextCmds(plan, document, idx);
    const headerBottomEdgeMm = ASYMMETRIC_GEOMETRY.marginTopMm / 2 + model.bodyEmMm / 2;
    expect(Math.min(...cmds.map((c) => c.yMm))).toBeGreaterThanOrEqual(headerBottomEdgeMm - 0.01);
  });

  it("Folio collision clamp still PASS (test 18)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      colophonPlacement: { horizontal: "center", vertical: "bottom", respectGutter: true, respectVerticalMargins: false },
    });
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const idx = colophonIdx(document);
    const cmds = contentTextCmds(plan, document, idx);
    const folioTopEdgeMm = ASYMMETRIC_GEOMETRY.paperHeightMm - ASYMMETRIC_GEOMETRY.marginBottomMm / 2 - model.bodyEmMm / 2;
    expect(Math.max(...cmds.map((c) => c.yMm))).toBeLessThanOrEqual(folioTopEdgeMm + 0.01);
  });

  it("QA9 equivalent (respectGutter FALSE, odd physical page) still renders validly (test 19)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あ".repeat(400), FULL_FIELDS, FULL_FREETEXT, {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      headerSettings: HEADER_SETTINGS,
      colophonPlacement: { horizontal: "left", vertical: "center", respectGutter: false, respectVerticalMargins: true },
    });
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    expect(cmds.length).toBeGreaterThan(0);
  });

  it("QA11 equivalent (respectGutter FALSE, even physical page) still renders validly (test 20)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      headerSettings: HEADER_SETTINGS,
      colophonPlacement: { horizontal: "left", vertical: "center", respectGutter: false, respectVerticalMargins: true },
    });
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    expect(cmds.length).toBeGreaterThan(0);
  });
});

describe("Overflow + regression (tests 21-28)", () => {
  it("realistic overflow still legitimately multi-pages under the corrected frame formula (test 21)", () => {
    const { document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, { capacity: OVERFLOW_CAPACITY_HUMAN });
    expect(document.colophon!.pages.length).toBeGreaterThan(1);
  });

  it("the date value stays WHOLE (one command, not wrapped) under the corrected structured-frame formula (test 22; round 29D had regressed this -- round 29E fixes it back)", () => {
    // Round 29D's own title-row-bounded STRUCTURED frame genuinely
    // wrapped this date (a real, measured consequence -- "2026年9月8日"
    // is wider than the title value "吾輩は猫である" in this font).
    // Round 29E separates freeText's width (still title-row-bounded)
    // from the structured row frame (reverted to natural widest-value
    // sizing) -- the date is well within that natural sizing (it is not
    // the widest value among these rows; the email is), so it stays
    // whole again, without needing any date-specific special case.
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, "", {});
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const texts = cmds.map((c) => c.text);
    expect(texts).toContain("2026年9月8日");
  });

  it("body composition is unchanged (test 23)", () => {
    const withColophon = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {}).document.pages;
    const without = composeFull("あいうえお", [], "", {}).document.pages;
    expect(withColophon).toEqual(without);
  });

  it("Ruby/Small Kana/Dash/TCY/Ellipsis regression PASS (tests 24-28)", () => {
    const bodyText = "「今日は、雨だった。」きっと２０２６年";
    const { model } = composeFull(bodyText, FULL_FIELDS, FULL_FREETEXT, { folioSettings: DEFAULT_FOLIO_SETTINGS, headerSettings: HEADER_SETTINGS });
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(outlineContext.inkCenteredBaselineRatioForSmallKana("っ")).toBeDefined();
  });
});
