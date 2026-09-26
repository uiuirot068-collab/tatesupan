import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../pageLayout";
import { composeV2Document, type V2BridgeResult } from "./composeV2Document";
import { buildV2PreviewDocument } from "./buildV2PreviewDocument";
import { buildV2UnitsFromManuscript } from "./manuscriptAdapter";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";
import type { PaintPlacedUnit } from "../../../typesetting-v2/renderer/preview/paintModel";
import type { PaintCommand } from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import { emphasisDotLane } from "../../../typesetting-v2/renderer/emphasisMarks";

// Post-beta typography Phase 1 — production (V2) path:
// manuscript -> units -> Core composition -> Preview paint + Publication
// PaintPlan (the one plan both PDF and JPG executors consume).

const MEASUREMENT = createFakeMeasurementProvider();

function settings(charsPerLine: number, linesPerColumn = 20): PageSettings {
  return { ...DEFAULT_PAGE_SETTINGS, charsPerLine, linesPerColumn, columnCount: 1 };
}

function compose(content: string, pageSettings: PageSettings = settings(10)): V2BridgeResult {
  return composeV2Document({ title: "T", content, settings: pageSettings, measurement: MEASUREMENT });
}

/** Visible text of every line, per page (paragraph-break atoms dropped). */
function pageLines(bridge: V2BridgeResult): string[][] {
  const cps = Array.from(bridge.source);
  return bridge.document.pages.map((page) =>
    page.columns.flatMap((column) =>
      column.lines
        .map((line) => line.placedUnits.map((u) => cps.slice(u.sourceSpan.start, u.sourceSpan.end).join("")).join("").replace(/\n/g, ""))
    )
  );
}

function previewUnits(bridge: V2BridgeResult): Array<PaintPlacedUnit & { pageIndex: number }> {
  const preview = buildV2PreviewDocument(bridge, {});
  return preview.pages.flatMap((page, pageIndex) =>
    page.columns.flatMap((column) => column.lines.flatMap((line) => line.units.map((unit) => ({ ...unit, pageIndex }))))
  );
}

const circles = (bridge: V2BridgeResult): Array<Extract<PaintCommand, { op: "circle" }>> =>
  bridge.plan.flatMap((page) => page.commands.filter((c): c is Extract<PaintCommand, { op: "circle" }> => c.op === "circle"));

describe("manuscript adapter: decoration + dash units", () => {
  const body = { maxDashRunCells: 9, decorations: true };

  it("plain text regression: no decoration key, no SEMANTIC_RUN when there is nothing to group", () => {
    const { units } = buildV2UnitsFromManuscript("body", "吾輩は猫である。", body);
    expect(units).toStrictEqual([{ kind: "TEXT", span: { blockId: "body", start: 0, end: 8 }, text: "吾輩は猫である。" }]);
  });

  it("carries 傍点 onto TEXT / RUBY / TCY units without changing spans or the composed flow", () => {
    const decorated = buildV2UnitsFromManuscript("body", "《《強調》》と《《｜漢字《かんじ》》》と《《12》》", body);
    const bare = buildV2UnitsFromManuscript("body", "強調と｜漢字《かんじ》と12", body);
    // Same composed flow (markers never reach Core) ...
    expect(decorated.source).toBe(bare.source);
    // ... and the range edge only splits a TEXT unit where the decoration starts/stops.
    expect(decorated.units.map((u) => [u.kind, u.span.start, u.span.end, "decoration" in u ? u.decoration?.emphasis : undefined])).toEqual([
      ["TEXT", 0, 2, "DOT"],
      ["TEXT", 2, 3, undefined],
      ["RUBY", 3, 5, "DOT"],
      ["TEXT", 5, 6, undefined],
      ["TCY", 6, 8, "DOT"],
    ]);
  });

  it("ruby regression: a basic ruby still becomes exactly the same ATOMIC RubyUnit (reading appended after the body flow)", () => {
    const { units, source } = buildV2UnitsFromManuscript("body", "｜漢字《かんじ》です", body);
    expect(source).toBe("漢字ですかんじ");
    expect(units).toStrictEqual([
      {
        kind: "RUBY",
        span: { blockId: "body", start: 0, end: 2 },
        rubyKind: "ATOMIC",
        baseSpan: { blockId: "body", start: 0, end: 2 },
        readingSpan: { blockId: "body", start: 4, end: 7 },
        readingText: "かんじ",
      },
      { kind: "TEXT", span: { blockId: "body", start: 2, end: 4 }, text: "です" },
    ]);
  });

  it("dash 2 chars and dash 4 chars become ONE DASH SEMANTIC_RUN each; a lone ― stays TEXT", () => {
    const { units } = buildV2UnitsFromManuscript("body", "あ――い――――う―え", body);
    expect(units.map((u) => (u.kind === "SEMANTIC_RUN" ? `DASH${u.length}` : u.kind === "TEXT" ? u.text : u.kind))).toEqual([
      "あ",
      "DASH2",
      "い",
      "DASH4",
      "う―え",
    ]);
  });

  it("a mixed ―— run is one run (legacy family), and a run longer than maxDashRunCells stays breakable TEXT", () => {
    expect(buildV2UnitsFromManuscript("body", "―—", body).units[0]).toMatchObject({ kind: "SEMANTIC_RUN", runKind: "DASH", length: 2 });
    const long = "―".repeat(10);
    expect(buildV2UnitsFromManuscript("body", long, body).units).toStrictEqual([
      { kind: "TEXT", span: { blockId: "body", start: 0, end: 10 }, text: long },
    ]);
  });

  it("default options (colophon / QA tools): no dash grouping and no decoration (markers are still removed)", () => {
    const { units, source } = buildV2UnitsFromManuscript("colophon", "《《強調》》――");
    expect(source).toBe("強調――");
    expect(units).toStrictEqual([
      { kind: "TEXT", span: { blockId: "colophon", start: 0, end: 2 }, text: "強調" },
      { kind: "TEXT", span: { blockId: "colophon", start: 2, end: 4 }, text: "――" },
    ]);
  });
});

describe("V2 composition: 傍点 never changes layout", () => {
  it("pagination regression: identical pages/lines/placements with and without the notation", () => {
    const narrow = settings(5, 2);
    const decorated = compose("あいう《《えおかきく》》けこさしすせそたちつてと", narrow);
    const bare = compose("あいうえおかきくけこさしすせそたちつてと", narrow);
    expect(decorated.document.pages.length).toBeGreaterThan(1);
    expect(decorated.document.pages).toStrictEqual(bare.document.pages);
  });

  it("ruby + bouten: the ruby's base placement and annotation geometry are untouched; only the dots are added (on the LEFT)", () => {
    const withDots = previewUnits(compose("《《｜漢字《かんじ》》》です"));
    const without = previewUnits(compose("｜漢字《かんじ》です"));
    const strip = (units: PaintPlacedUnit[]) => units.map((unit) => ({ ...unit, emphasisDots: undefined }));
    expect(strip(withDots)).toStrictEqual(strip(without));
    const ruby = withDots.find((u) => u.kind === "RUBY")!;
    expect(ruby.rubyAnnotation?.status).toBe("PLACED");
    expect(ruby.emphasisDots).toMatchObject({ side: "LEFT" });
    expect(ruby.emphasisDots!.flowCentersPx).toHaveLength(2);
  });

  it("TCY regression: a decorated 縦中横 cell composes exactly like an undecorated one and gets ONE dot", () => {
    const withDots = previewUnits(compose("第《《12》》話"));
    const without = previewUnits(compose("第12話"));
    const tcy = withDots.find((u) => u.kind === "TCY")!;
    expect({ ...tcy, emphasisDots: undefined }).toStrictEqual({ ...without.find((u) => u.kind === "TCY")!, emphasisDots: undefined });
    expect(tcy.emphasisDots).toEqual({ side: "RIGHT", flowCentersPx: [tcy.heightPx / 2] });
  });
});

describe("V2 paint: 傍点 dots (Preview and the PDF/JPG PaintPlan)", () => {
  it("basic bouten: one RIGHT-side dot per emphasised character, none elsewhere", () => {
    const units = previewUnits(compose("これは《《強調》》です"));
    expect(units.filter((u) => u.emphasisDots).map((u) => u.text)).toEqual(["強", "調"]);
    expect(units.every((u) => !u.emphasisDots || u.emphasisDots.side === "RIGHT")).toBe(true);
  });

  it("punctuation and spaces inside a range take no dot", () => {
    const units = previewUnits(compose("《《強い、　「声」！》》"));
    expect(units.filter((u) => u.emphasisDots).map((u) => u.text)).toEqual(["強", "い", "声"]);
  });

  it("line-end bouten: a range wrapping to the next line keeps a dot on every emphasised character of both lines", () => {
    const bridge = compose("「あい《《うえおか》》き", settings(4));
    expect(pageLines(bridge)[0]).toEqual(["「あいう", "えおかき"]);
    const dotted = previewUnits(bridge).filter((u) => u.emphasisDots).map((u) => u.text);
    expect(dotted).toEqual(["う", "え", "お", "か"]);
  });

  it("page-boundary bouten: dots appear on both pages of a range split by a page break", () => {
    const bridge = compose("「あいう《《えおかき》》く", settings(3, 2));
    expect(bridge.document.pages.length).toBeGreaterThan(1);
    const dottedByPage = previewUnits(bridge).filter((u) => u.emphasisDots).map((u) => `${u.pageIndex}:${u.text}`);
    expect(dottedByPage).toEqual(["0:え", "0:お", "1:か", "1:き"]);
  });

  it("Preview and the Publication PaintPlan paint the SAME dots: same count, same page-relative positions, same side", () => {
    const bridge = compose("《《静かな》》夜に｜月《つき》と《《｜星《ほし》》》が《《12》》個", settings(8));
    const preview = buildV2PreviewDocument(bridge, {});
    const page = preview.pages[0];
    const previewDots = page.columns.flatMap((column) =>
      column.lines.flatMap((line) =>
        line.units.flatMap((unit) => {
          if (!unit.emphasisDots) return [];
          const lane = emphasisDotLane(preview.fontSizePx, line.widthPx, unit.emphasisDots.side);
          const lineCenterFromRight = column.rightPx + line.rightPx + line.widthPx / 2;
          return unit.emphasisDots.flowCentersPx.map((center) => ({
            y: (unit.topPx + center) / page.heightPx,
            // Fraction of the content width measured from the right edge (vertical-rl).
            x: (lineCenterFromRight - lane.centerFromParentCenter) / page.widthPx,
            r: lane.radius / page.heightPx,
          }));
        })
      )
    );
    // Both painters place content in the same canonical text frame: Preview
    // page box (px) <-> Publication model page box (mm), anchored top-right.
    const geometry = bridge.pageGeometry;
    const contentWidthMm = bridge.model.pages[0].widthMm;
    const contentHeightMm = bridge.model.pages[0].heightMm;
    const publicationDots = circles(bridge).map((c) => ({
      y: (c.yMm - geometry.marginTopMm) / contentHeightMm,
      x: (geometry.paperWidthMm - geometry.marginRightMm - c.xMm) / contentWidthMm,
      r: c.radiusMm / contentHeightMm,
    }));
    expect(previewDots).toHaveLength(5); // 静・か・な + 星 (ruby base, LEFT) + one 縦中横 cell
    expect(publicationDots).toHaveLength(previewDots.length);
    previewDots.forEach((dot, i) => {
      expect(publicationDots[i].y).toBeCloseTo(dot.y, 3);
      expect(publicationDots[i].x).toBeCloseTo(dot.x, 3);
      expect(publicationDots[i].r).toBeCloseTo(dot.r, 4);
    });
  });

  it("an undecorated manuscript emits no dot commands at all (plan regression)", () => {
    expect(circles(compose("｜漢字《かんじ》と12と――と本文"))).toEqual([]);
  });
});

describe("V2 continuous dash (――)", () => {
  it("dash 2 chars: never split across a line end — the whole run moves to the next line", () => {
    expect(pageLines(compose("「あいう――」", settings(5)))[0]).toEqual(["「あいう", "――」"]);
  });

  it("dash 4 chars: never split across a line end", () => {
    expect(pageLines(compose("「あ――――い", settings(5)))[0]).toEqual(["「あ", "――――い"]);
  });

  it("line-start and line-end runs: a run exactly filling the line end stays whole and painted over 2 cells", () => {
    const bridge = compose("「あい――うえお", settings(5));
    expect(pageLines(bridge)[0]).toEqual(["「あい――", "うえお"]);
    const units = previewUnits(bridge);
    const dash = units.find((u) => u.semanticRunKind === "DASH")!;
    const cell = units.find((u) => u.text === "あ")!.heightPx;
    // The run is the line's LAST atom (height is estimated); it must still
    // span its own 2 cells, not a neighbour's 1-cell delta.
    expect(dash.heightIsApproximate).toBe(true);
    expect(dash.heightPx).toBeCloseTo(cell * 2, 6);
    expect(dash.text).toBe("――");
  });

  it("page boundary: a run that does not fit the last line of a page starts the next page whole", () => {
    const bridge = compose("「あいうえかきく――け", settings(4, 2));
    const pages = pageLines(bridge);
    expect(pages[0]).toEqual(["「あいう", "えかきく"]);
    expect(pages[1][0].startsWith("――")).toBe(true);
  });

  it("a paragraph opening with ―― keeps its 一字下げ (parity with the previous per-character composition)", () => {
    const bridge = compose("――始まり", settings(10));
    expect(bridge.document.pages[0].columns[0].lines[0].indentTick).toBeGreaterThan(0);
  });

  it("an over-long dash run (separator line) never HOLDs the document; it wraps like before", () => {
    const bridge = compose("―".repeat(12), settings(5));
    expect(bridge.document.hold).toBe(false);
    expect(pageLines(bridge)[0].join("")).toBe("―".repeat(12));
  });

  it("dash next to ruby / bouten / TCY composes without HOLD and keeps each unit intact", () => {
    const bridge = compose("｜漢字《かんじ》――《《強調》》――12――", settings(6));
    expect(bridge.document.hold).toBe(false);
    const kinds = previewUnits(bridge).map((u) => u.semanticRunKind ?? u.kind);
    expect(kinds.filter((k) => k === "DASH")).toHaveLength(3);
    expect(kinds).toContain("RUBY");
    expect(kinds).toContain("TCY");
  });

  it("PDF/JPG plan paints a 2-char run as exactly two vertical dash glyphs inside its 2-cell box", () => {
    const bridge = compose("「あ――い", settings(10));
    const texts = bridge.plan[0].commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    expect(texts.filter((c) => /[―︱]/.test(c.text))).toHaveLength(2);
  });
});
