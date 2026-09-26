import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, computePageLayout, type PageSettings } from "../pageLayout";
import { paginateTokens, tokenizeTategaki } from "../tategaki";
import { composeV2Document, type V2BridgeResult } from "./composeV2Document";
import { buildV2PreviewDocument } from "./buildV2PreviewDocument";
import { colophonPhysicalIndex, physicalIndexForBodyIndex, resolvePdfPhysicalIndices } from "./pageIndex";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";
import type { PhysicalPageRef } from "../../../typesetting-v2/core/layout/schema";
import { DEMO_SEED_CONTENT } from "../../constants/demoData";

// Phase 2 (V2 canonicalization) architecture locks. See
// docs/TATESPUN_V2_CANONICALIZATION_AUDIT.md for the map these protect.

const MEASUREMENT = createFakeMeasurementProvider();
const REPO = join(__dirname, "..", "..", "..");

function compose(content: string, settings: PageSettings = DEFAULT_PAGE_SETTINGS): V2BridgeResult {
  return composeV2Document({ title: "T", content, settings, measurement: MEASUREMENT });
}

const prose = (paragraphs: number) =>
  Array.from({ length: paragraphs }, (_, i) => `第${i}段落。吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。「そうか」と彼は言った。――それから……沈黙。`).join("\n");

describe("page-index vocabulary (body index <-> physical PaintPlan index)", () => {
  const withColophonAfter1: PhysicalPageRef[] = [
    { kind: "body", index: 0 },
    { kind: "colophon", index: 0 },
    { kind: "body", index: 1 },
    { kind: "body", index: 2 },
  ];

  it("maps body indices through Core's pageSequence, including after a mid-book colophon", () => {
    expect([0, 1, 2].map((i) => physicalIndexForBodyIndex(withColophonAfter1, i))).toEqual([0, 2, 3]);
    expect(colophonPhysicalIndex(withColophonAfter1)).toBe(1);
  });

  it("fails closed (-1) for an unknown body page, a missing colophon, or no composition yet", () => {
    expect(physicalIndexForBodyIndex(withColophonAfter1, 9)).toBe(-1);
    expect(colophonPhysicalIndex([{ kind: "body", index: 0 }])).toBe(-1);
    expect(physicalIndexForBodyIndex(undefined, 0)).toBe(-1);
  });

  it("PDF scope: all = every canonical page; selected = chosen bodies (+ colophon), de-duplicated, publication order", () => {
    expect(resolvePdfPhysicalIndices({ pageSequence: withColophonAfter1, planLength: 4, scope: "all", bodyIndices: [2], includeColophon: false })).toEqual([0, 1, 2, 3]);
    expect(resolvePdfPhysicalIndices({ pageSequence: withColophonAfter1, planLength: 4, scope: "selected", bodyIndices: [2, 0, 2], includeColophon: true })).toEqual([0, 1, 3]);
    // An unresolvable body page is kept as -1 so the caller's length guard refuses the export.
    expect(resolvePdfPhysicalIndices({ pageSequence: withColophonAfter1, planLength: 4, scope: "selected", bodyIndices: [7], includeColophon: false })).toEqual([-1]);
  });

  it("Core's real pageSequence places the colophon where the Editor setting asks", () => {
    const settings: PageSettings = {
      ...DEFAULT_PAGE_SETTINGS,
      colophon: { ...DEFAULT_PAGE_SETTINGS.colophon, enabled: true, pagePosition: { mode: "after-body-page", afterBodyPage: 1 } },
    };
    const bridge = compose(prose(80), settings);
    const sequence = bridge.document.pageSequence;
    expect(colophonPhysicalIndex(sequence)).toBe(1);
    expect(physicalIndexForBodyIndex(sequence, 1)).toBe(2);
    expect(bridge.plan).toHaveLength(sequence.length);
  });
});

describe("LEGACY page list <-> V2 composition parity (Preview page list still comes from paginateTokens)", () => {
  // PreviewPane builds its page list, selection, image-break pages and export
  // scopes from LEGACY `paginateTokens`, then paints V2 pages by body index.
  // That is only correct while both agree on the body page count. Settings
  // committed by the settings panel are always the EFFECTIVE grid
  // (computePageLayout), which is the case locked here; over-capacity
  // settings diverge (see the audit doc, "Page/index ownership").
  const committed = (settings: PageSettings): PageSettings => {
    const layout = computePageLayout(settings);
    return { ...settings, charsPerLine: layout.charsPerLine, linesPerColumn: layout.linesPerColumn };
  };
  const legacyBodyPages = (content: string, settings: PageSettings) => {
    const layout = computePageLayout(settings);
    return paginateTokens(tokenizeTategaki(content), {
      charsPerLine: layout.charsPerLine,
      linesPerPage: layout.linesPerPage,
      columnCount: settings.columnCount,
      linesPerColumn: layout.linesPerColumn,
    }).length;
  };
  const v2BodyPages = (content: string, settings: PageSettings) =>
    compose(content, settings).document.pageSequence.filter((ref) => ref.kind === "body").length;

  const manuscripts: Array<[string, string]> = [
    ["demo seed", DEMO_SEED_CONTENT],
    ["long prose with dash/ellipsis/brackets", prose(200)],
    ["kinsoku-heavy", Array.from({ length: 120 }, () => "あいうえおかきくけこさしすせそたちつてと・なにぬねの：はひふへほ；まみむめも。」").join("\n")],
    ["ruby-first paragraphs", Array.from({ length: 120 }, () => "｜漢字《かんじ》から始まる段落がここにあります。これは行を折り返す長い文章です。").join("\n")],
    ["images and page breaks", Array.from({ length: 20 }, (_, i) => `第${i}章\n本文です。\n【IMG:img${i}:40:30:center】\n続き。\n【改ページ】`).join("\n")],
    ["bouten", prose(60).replace(/吾輩は猫/g, "《《吾輩は猫》》")],
  ];

  for (const [name, content] of manuscripts) {
    it(`agrees on body page count: ${name} (1段 / 2段)`, () => {
      for (const settings of [committed(DEFAULT_PAGE_SETTINGS), committed({ ...DEFAULT_PAGE_SETTINGS, columnCount: 2 })]) {
        expect(v2BodyPages(content, settings)).toBe(legacyBodyPages(content, settings));
      }
    });
  }
});

describe("one composition feeds Preview and Publication", () => {
  it("Preview pages, Publication pages and PaintPlan pages are the same canonical pages with the same placed atoms", () => {
    const settings: PageSettings = { ...DEFAULT_PAGE_SETTINGS, colophon: { ...DEFAULT_PAGE_SETTINGS.colophon, enabled: true } };
    const bridge = compose(prose(60) + "\n｜漢字《かんじ》と12と《《傍点》》", settings);
    const preview = buildV2PreviewDocument(bridge, {});
    expect(preview.pages).toHaveLength(bridge.document.pageSequence.length);
    expect(bridge.plan).toHaveLength(bridge.document.pageSequence.length);

    bridge.model.pages.forEach((publicationPage, i) => {
      const previewPage = preview.pages[bridge.document.pageSequence.findIndex((ref) => ref.kind === "body" && ref.index === i)];
      const pub = publicationPage.columns.flatMap((c) => c.lines.flatMap((l) => l.units));
      const pre = previewPage.columns.flatMap((c) => c.lines.flatMap((l) => l.units));
      expect(pre.map((u) => [u.id, u.kind, u.text, u.semanticRunKind ?? null])).toEqual(pub.map((u) => [u.id, u.kind, u.text, u.semanticRunKind ?? null]));
      // Same flow position relative to the canonical frame (px vs mm are only a unit change).
      pre.forEach((unit, k) => {
        expect(unit.topPx / previewPage.heightPx).toBeCloseTo(pub[k].topMm / publicationPage.heightMm, 6);
        expect(unit.heightPx / previewPage.heightPx).toBeCloseTo(pub[k].heightMm / publicationPage.heightMm, 6);
        expect(unit.emphasisDots?.flowCentersPx.length ?? 0).toBe(pub[k].emphasisDots?.flowCentersMm.length ?? 0);
      });
    });
  });
});

describe("line-final atom extent is one shared contract (renderer/lastAtomExtent.ts)", () => {
  it("a document-final single character is one body cell in BOTH Preview and Publication (was 1.5em = column pitch in PDF/JPG)", () => {
    const bridge = compose("あいう\n完");
    const previewPage = buildV2PreviewDocument(bridge, {}).pages[0];
    const publicationPage = bridge.model.pages[0];
    const pre = previewPage.columns[0].lines[1].units[0];
    const pub = publicationPage.columns[0].lines[1].units[0];
    expect(pre.text).toBe("完");
    expect(pre.heightIsApproximate).toBe(true);
    expect(pub.heightMm).toBeCloseTo(bridge.model.bodyEmMm, 6);
    expect(pre.heightPx / previewPage.heightPx).toBeCloseTo(pub.heightMm / publicationPage.heightMm, 6);
  });

  it("the PDF/JPG glyph of that final character sits at the same in-cell baseline as an ordinary character", () => {
    const bridge = compose("あいう\n完");
    const texts = bridge.plan[0].commands.filter((c): c is Extract<(typeof bridge.plan)[number]["commands"][number], { op: "text" }> => c.op === "text");
    const topMm = bridge.pageGeometry.marginTopMm;
    const firstOffset = texts.find((c) => c.text === "あ")!.yMm - topMm;
    const finalOffset = texts.find((c) => c.text === "完")!.yMm - topMm;
    // Line 2 has no indent-free difference: both are the first cell of a paragraph line.
    expect(finalOffset).toBeCloseTo(firstOffset, 6);
  });
});

describe("Phase 5: the Preview page list is derived from the V2 layout in V2 mode", () => {
  const model = readFileSync(join(REPO, "src", "lib", "v2Bridge", "previewPageModel.ts"), "utf8");
  const pane = readFileSync(join(REPO, "src", "components", "PreviewPane.tsx"), "utf8");

  it("the V2 page model never calls the LEGACY paginator (it is a view over Core's pageSequence)", () => {
    const code = model.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(code).not.toMatch(/paginateTokens|computePageSourceRanges|tokenizeTategaki/);
    expect(code).toMatch(/import type \{[^}]*\} from "\.\.\/tategaki";/);
    expect(code).toContain("layout.document.pageSequence");
  });

  it("exactly one page-count authority (no LEGACY + V2 last-writer race)", () => {
    expect(pane.match(/onBodyPageCountChange\?\.\(/g)).toHaveLength(1);
    expect(pane).toContain("onBodyPageCountChange?.(listPages.length)");
  });

  it("list, image ownership, caret mapping and reorder/insert ranges read the V2 model in V2 mode", () => {
    expect(pane).toContain("const listPages: TategakiPage[] = v2PageModel ? v2PageModel.overlayPages : pages;");
    expect(pane).toContain("if (v2PageModel) return v2PageModel.imagePageIndicesById;");
    expect(pane).toContain("findPageIndexForCharIndex(listSourceRanges, cursorIndex)");
    expect(pane).toContain("content.slice(listSourceRanges[runStart].start, listSourceRanges[runEnd].end)");
    expect(pane).toContain("const insertAt = listSourceRanges[index].end;");
    expect(pane).not.toMatch(/page=\{pages\[bodyIndex\]\}/);
  });
});

describe("V2 path never depends on the LEGACY DOM renderer / capture stack", () => {
  const FORBIDDEN = /from\s+["'][^"']*(components\/PageCard|components\/ColophonPageCard|utils\/exportCapture|utils\/exportPdf|utils\/exportImage|html-to-image|html2canvas)["']/;
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return files(path);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
  const v2Sources = [
    ...files(join(REPO, "src", "lib", "v2Bridge")),
    ...files(join(REPO, "src", "workers")),
    join(REPO, "src", "lib", "v2BrowserExport.ts"),
    ...files(join(REPO, "typesetting-v2", "core")),
    ...files(join(REPO, "typesetting-v2", "renderer")),
  ];

  it("covers the whole V2 pipeline", () => {
    expect(v2Sources.length).toBeGreaterThan(40);
  });

  for (const file of v2Sources) {
    it(`${relative(REPO, file)} imports no LEGACY renderer/capture module`, () => {
      expect(readFileSync(file, "utf8")).not.toMatch(FORBIDDEN);
    });
  }
});
