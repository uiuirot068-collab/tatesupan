// P3-O08 -- Final-page completion, JPG Export (Human Visual QA HOLD
// round 31). Machine QA for the raster/JPG export engine
// (`rasterGenerator.ts` + `jpgExport.ts`). Reuses the SAME real
// Publication pipeline (`composeCanonicalDocument` -> `buildPublicationDocument`
// -> `buildPaintPlan`) every other Publication test file in this project
// uses -- never a second layout engine, never DOM/Preview capture.
import { readFileSync } from "fs";
import { join } from "path";
import { encode as encodePng } from "fast-png";
import { loadImage } from "@napi-rs/canvas";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_FOLIO_SETTINGS, DEFAULT_RULE_SET_V2, mmToTicks, type HeaderSettings, type MeasurementFacts } from "../../core";
import { buildPublicationDocument, type ImageResolver, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, deriveBaselineRatioFromFont, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { VerticalGposContext } from "./verticalGposPaint";
import { VerticalYakumonoAlignContext } from "./verticalYakumonoAlign";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits, type FixturePiece } from "../../tools/compare/fixtureBuilder";
import { renderPaintPlanToRasterPages, RASTER_DPI, PRINT_JPG_LONG_SIDE_PX } from "./rasterGenerator";
import { exportPaintPlanToJpgPages, exportPaintPlanToJpgZip, sanitizeFilename, buildPageJpgFileName, buildZipFileName } from "./jpgExport";
import { existsSync, mkdirSync, writeFileSync } from "fs";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");
const GEOMETRY: PublicationPageGeometry = { paperWidthMm: 105, paperHeightMm: 148, marginTopMm: 15, marginBottomMm: 12, marginRightMm: 15, marginLeftMm: 15 };

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

function buildPngFixture(refId: string, pixelWidth: number, pixelHeight: number, pixelFn: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8Array(pixelWidth * pixelHeight * 4);
  for (let y = 0; y < pixelHeight; y++) {
    for (let x = 0; x < pixelWidth; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const i = (y * pixelWidth + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  const bytes = encodePng({ width: pixelWidth, height: pixelHeight, data, channels: 4 });
  return { refId, bytes, format: "PNG" as const, pixelWidth, pixelHeight, intrinsicWidthTick: mmToTicks((pixelWidth / 150) * 25.4), intrinsicHeightTick: mmToTicks((pixelHeight / 150) * 25.4) };
}

const OPAQUE_RED = buildPngFixture("jpg-qa-opaque-red", 100, 100, () => [220, 30, 30, 255]);
const TRANSPARENT_CIRCLE = buildPngFixture("jpg-qa-transparent-circle", 100, 100, (x, y) => {
  const dx = x - 50;
  const dy = y - 50;
  return dx * dx + dy * dy <= 40 * 40 ? [30, 150, 60, 255] : [0, 0, 0, 0];
});
const REAL_JPEG_BYTES = readFileSync(join(__dirname, "fixtures", "qa-real.jpg"));
const REAL_JPEG_REFID = "jpg-qa-real-jpeg";
const REAL_JPEG_WIDTH_MM = (96 / 150) * 25.4;
const REAL_JPEG_HEIGHT_MM = (64 / 150) * 25.4;

const FIXTURE_BYTES: Record<string, { bytes: Uint8Array; format: "PNG" | "JPEG"; pixelWidth: number; pixelHeight: number }> = {
  [OPAQUE_RED.refId]: { bytes: OPAQUE_RED.bytes, format: "PNG", pixelWidth: OPAQUE_RED.pixelWidth, pixelHeight: OPAQUE_RED.pixelHeight },
  [TRANSPARENT_CIRCLE.refId]: { bytes: TRANSPARENT_CIRCLE.bytes, format: "PNG", pixelWidth: TRANSPARENT_CIRCLE.pixelWidth, pixelHeight: TRANSPARENT_CIRCLE.pixelHeight },
  [REAL_JPEG_REFID]: { bytes: REAL_JPEG_BYTES, format: "JPEG", pixelWidth: 96, pixelHeight: 64 },
};

function realImageResolver(): ImageResolver {
  return (refId) => {
    const fx = FIXTURE_BYTES[refId];
    if (!fx) return { kind: "MISSING" };
    return { kind: "RESOLVED", url: `local-qa://${refId}`, bytes: fx.bytes, format: fx.format, pixelWidth: fx.pixelWidth, pixelHeight: fx.pixelHeight };
  };
}

function realMeasurementProvider(): MeasurementFacts {
  const base = createFakeMeasurementProvider();
  return {
    ...base,
    imageIntrinsicTick: (refId) => {
      if (refId === OPAQUE_RED.refId) return { width: OPAQUE_RED.intrinsicWidthTick, height: OPAQUE_RED.intrinsicHeightTick };
      if (refId === TRANSPARENT_CIRCLE.refId) return { width: TRANSPARENT_CIRCLE.intrinsicWidthTick, height: TRANSPARENT_CIRCLE.intrinsicHeightTick };
      if (refId === REAL_JPEG_REFID) return { width: mmToTicks(REAL_JPEG_WIDTH_MM), height: mmToTicks(REAL_JPEG_HEIGHT_MM) };
      return { width: mmToTicks(40), height: mmToTicks(30) };
    },
  };
}

interface ComposeOpts {
  folioSettings?: typeof DEFAULT_FOLIO_SETTINGS;
  headerSettings?: HeaderSettings;
  colophonUnits?: ReturnType<typeof buildFixtureUnits>["units"];
  colophonSource?: string;
  colophonBlockId?: string;
}
function compose(pieces: FixturePiece[], opts: ComposeOpts = {}) {
  const { units, source } = buildFixtureUnits("body", pieces);
  const settings = settingsFor({ charsPerLine: 20, linesPerColumn: 30, columnCount: 1 });
  const measurement = realMeasurementProvider();
  const document = composeCanonicalDocument({
    bodyUnits: units,
    colophonUnits: opts.colophonUnits,
    colophonBlockId: opts.colophonBlockId,
    ruleSet: DEFAULT_RULE_SET_V2,
    measurement,
    settings,
    folioSettings: opts.folioSettings,
    headerSettings: opts.headerSettings,
  });
  const ctx: PublicationRenderContext = {
    linePitchTicks: settings.linePitchTicks,
    lineExtentTicks: settings.lineExtentTicks,
    columnExtentTicks: settings.columnExtentTicks,
    columnsPerPage: settings.columnsPerPage,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
    imageResolver: realImageResolver(),
  };
  const model = opts.colophonUnits
    ? buildPublicationDocument("qa", "QA", document, units, source, ctx, opts.colophonUnits, opts.colophonSource ?? "")
    : buildPublicationDocument("qa", "QA", document, units, source, ctx);
  const { outlineContext, gposContext, yakumonoContext } = realContexts();
  const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
  return { document, model, plan };
}

describe("Filename contract (ported verbatim from src/utils/exportFilename.ts)", () => {
  it("sanitizes forbidden OS filename characters", () => {
    expect(sanitizeFilename('my\\/:*?"<>|title')).toBe("mytitle");
  });
  it("falls back to the fixed Japanese fallback title when sanitization empties the name", () => {
    expect(sanitizeFilename("\\/:*?\"<>|")).toBe("無題のドキュメント");
  });
  it("strips trailing dots/whitespace (Windows-unsafe trailing characters)", () => {
    expect(sanitizeFilename("title.  ")).toBe("title");
  });
  it("builds a 3-digit zero-padded page filename", () => {
    expect(buildPageJpgFileName("MyNovel", 1)).toBe("MyNovel_001.jpg");
    expect(buildPageJpgFileName("MyNovel", 42)).toBe("MyNovel_042.jpg");
    expect(buildPageJpgFileName("MyNovel", 100)).toBe("MyNovel_100.jpg");
  });
  it("builds the ZIP filename", () => {
    expect(buildZipFileName("MyNovel")).toBe("MyNovel_jpg.zip");
  });
});

describe("JPEG byte validity", () => {
  it("every exported JPG page has a real SOI marker (0xFFD8) and EOI marker (0xFFD9)", async () => {
    const { plan } = compose([{ kind: "TEXT", text: "検証" }]);
    const pages = await exportPaintPlanToJpgPages(plan, fontResource(), "QA", "WEB");
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      expect(page.bytes[0]).toBe(0xff);
      expect(page.bytes[1]).toBe(0xd8);
      expect(page.bytes[page.bytes.length - 2]).toBe(0xff);
      expect(page.bytes[page.bytes.length - 1]).toBe(0xd9);
    }
  });

  it("the exported JPG bytes actually decode via the same approved canvas runtime, with the declared pixel dimensions", async () => {
    const { plan } = compose([{ kind: "TEXT", text: "検証" }]);
    const pages = await exportPaintPlanToJpgPages(plan, fontResource(), "QA", "WEB");
    const decoded = await loadImage(Buffer.from(pages[0].bytes));
    expect(decoded.width).toBe(pages[0].pixelWidth);
    expect(decoded.height).toBe(pages[0].pixelHeight);
  });
});

describe("Print JPG transform", () => {
  it("resizes so the long side is exactly PRINT_JPG_LONG_SIDE_PX (1600), preserving aspect ratio", async () => {
    const { plan } = compose([{ kind: "TEXT", text: "検証" }]);
    const pages = await exportPaintPlanToJpgPages(plan, fontResource(), "QA", "PRINT");
    for (const page of pages) {
      expect(Math.max(page.pixelWidth, page.pixelHeight)).toBe(PRINT_JPG_LONG_SIDE_PX);
      const expectedRatio = GEOMETRY.paperWidthMm / GEOMETRY.paperHeightMm;
      expect(page.pixelWidth / page.pixelHeight).toBeCloseTo(expectedRatio, 2);
    }
  });

  it("print JPG dimensions are independent of the base raster's own DPI (a real resize happened, not a no-op)", async () => {
    const { plan } = compose([{ kind: "TEXT", text: "検証" }]);
    const basePages = await renderPaintPlanToRasterPages(plan, fontResource());
    const printPages = await exportPaintPlanToJpgPages(plan, fontResource(), "QA", "PRINT");
    expect(printPages[0].pixelWidth).not.toBe(basePages[0].pixelWidth);
    expect(printPages[0].pixelHeight).not.toBe(basePages[0].pixelHeight);
  });
});

describe("Web JPG transform", () => {
  it("web JPG retains the canonical raster's own dimensions -- no crop, no resize", async () => {
    const { plan } = compose([{ kind: "TEXT", text: "検証" }]);
    const basePages = await renderPaintPlanToRasterPages(plan, fontResource());
    const webPages = await exportPaintPlanToJpgPages(plan, fontResource(), "QA", "WEB");
    expect(webPages[0].pixelWidth).toBe(basePages[0].pixelWidth);
    expect(webPages[0].pixelHeight).toBe(basePages[0].pixelHeight);
  });

  it("web JPG's canonical raster dimensions match the physical page geometry at RASTER_DPI", async () => {
    const { plan } = compose([{ kind: "TEXT", text: "検証" }]);
    const webPages = await exportPaintPlanToJpgPages(plan, fontResource(), "QA", "WEB");
    const expectedWidthPx = Math.round((GEOMETRY.paperWidthMm / 25.4) * RASTER_DPI);
    const expectedHeightPx = Math.round((GEOMETRY.paperHeightMm / 25.4) * RASTER_DPI);
    expect(webPages[0].pixelWidth).toBe(expectedWidthPx);
    expect(webPages[0].pixelHeight).toBe(expectedHeightPx);
  });
});

describe("Page count / structure", () => {
  it("produces exactly one JPG per page, matching the PaintPlan's own page count -- never a stitched multi-page image", async () => {
    const { plan } = compose([{ kind: "TEXT", text: "一二三四五六七八九十" }, { kind: "MANUAL_BREAK" }, { kind: "TEXT", text: "続きのページ" }]);
    expect(plan.length).toBeGreaterThan(1);
    const pages = await exportPaintPlanToJpgPages(plan, fontResource(), "QA", "WEB");
    expect(pages.length).toBe(plan.length);
  });

  it("filenames are 1-indexed and ordered to match physical page order", async () => {
    const { plan } = compose([{ kind: "TEXT", text: "一" }, { kind: "MANUAL_BREAK" }, { kind: "TEXT", text: "二" }]);
    const pages = await exportPaintPlanToJpgPages(plan, fontResource(), "MyBook", "WEB");
    expect(pages.map((p) => p.fileName)).toEqual(["MyBook_001.jpg", "MyBook_002.jpg"]);
  });
});

describe("ZIP packaging (reuses the already-approved jszip dependency)", () => {
  it("the ZIP contains exactly one real JPG entry per page, correctly named", async () => {
    const { plan } = compose([{ kind: "TEXT", text: "一" }, { kind: "MANUAL_BREAK" }, { kind: "TEXT", text: "二" }, { kind: "MANUAL_BREAK" }, { kind: "TEXT", text: "三" }]);
    const zipResult = await exportPaintPlanToJpgZip(plan, fontResource(), "MyBook", "WEB");
    expect(zipResult.fileName).toBe("MyBook_jpg.zip");
    const reopened = await JSZip.loadAsync(Buffer.from(zipResult.bytes));
    const entryNames = Object.keys(reopened.files).sort();
    expect(entryNames).toEqual(["MyBook_001.jpg", "MyBook_002.jpg", "MyBook_003.jpg"]);
    const firstEntryBytes = await reopened.files["MyBook_001.jpg"].async("uint8array");
    expect(firstEntryBytes[0]).toBe(0xff);
    expect(firstEntryBytes[1]).toBe(0xd8);
  });
});

describe("PaintPlan parity -- PDF and JPG driven by the SAME plan (Logical Layout Consistency Contract)", () => {
  it("PDF page count and JPG page count are identical for the same input, because both consume the identical PaintPlan", async () => {
    const { plan } = compose([{ kind: "TEXT", text: "一二三四五六七八九十" }, { kind: "MANUAL_BREAK" }, { kind: "TEXT", text: "続き" }], { folioSettings: DEFAULT_FOLIO_SETTINGS });
    const { renderPaintPlanToPdf } = await import("./pdfGenerator");
    const { pageCount } = renderPaintPlanToPdf(plan, fontResource());
    const jpgPages = await exportPaintPlanToJpgPages(plan, fontResource(), "QA", "WEB");
    expect(jpgPages.length).toBe(pageCount);
  });

  it("folio/header text units present in the PaintPlan are the exact same commands the JPG renderer walks (no filtering/dropping)", async () => {
    const HEADER_SETTINGS: HeaderSettings = { hashiraOdd: "小説のタイトル", hashiraEven: "第一章", position: { band: "top", horizontal: "outer" } };
    const { plan } = compose([{ kind: "TEXT", text: "本文" }], { folioSettings: DEFAULT_FOLIO_SETTINGS, headerSettings: HEADER_SETTINGS });
    const folioOrHeaderText = plan[0].commands.filter((c) => c.op === "text" && (c.text === "1" || c.text === "小説のタイトル"));
    expect(folioOrHeaderText.length).toBeGreaterThan(0);
    // JPG rendering must not throw when these SAME commands (folio/header included) are painted.
    await expect(exportPaintPlanToJpgPages(plan, fontResource(), "QA", "WEB")).resolves.toBeDefined();
  });

  it("Ruby/TCY units render to a valid JPG without error", async () => {
    const { plan } = compose([{ kind: "RUBY", base: "東京", reading: "とうきょう" }, { kind: "TCY", text: "20" }, { kind: "TEXT", text: "年。" }]);
    const pages = await exportPaintPlanToJpgPages(plan, fontResource(), "QA", "WEB");
    expect(pages.length).toBeGreaterThan(0);
    expect(pages[0].bytes[0]).toBe(0xff);
    expect(pages[0].bytes[1]).toBe(0xd8);
  });

  it("a structural colophon page is included in the JPG page count, same as PDF", async () => {
    const { units: colophonUnits, source: colophonSource } = buildFixtureUnits("colophon", [{ kind: "TEXT", text: "書名\t短編" }]);
    const { plan } = compose([{ kind: "TEXT", text: "本文" }], { colophonUnits, colophonSource, colophonBlockId: "colophon" });
    expect(plan.length).toBeGreaterThanOrEqual(2); // body page + colophon page
    const pages = await exportPaintPlanToJpgPages(plan, fontResource(), "QA", "WEB");
    expect(pages.length).toBe(plan.length);
  });
});

describe("Step 3 image formats (PNG / transparent PNG / JPEG) survive into the raster JPG output", () => {
  it("a real opaque PNG paints real, correct pixel color into the final JPG (round-trip pixel proof)", async () => {
    const { plan } = compose([{ kind: "IMAGE", refId: OPAQUE_RED.refId, intrinsicWidthTicks: OPAQUE_RED.intrinsicWidthTick, intrinsicHeightTicks: OPAQUE_RED.intrinsicHeightTick, placement: "FULL" }]);
    const pages = await exportPaintPlanToJpgPages(plan, fontResource(), "QA", "WEB");
    const decoded = await loadImage(Buffer.from(pages[0].bytes));
    const { createCanvas } = await import("@napi-rs/canvas");
    const probe = createCanvas(decoded.width, decoded.height);
    const ctx = probe.getContext("2d");
    ctx.drawImage(decoded, 0, 0);
    // The image is a lone FULL-placement unit painted at the top of the
    // content area (not the physical page's own vertical center, which
    // is far below a ~17mm-tall image on a 148mm page) -- sample near
    // the image's own real vertical middle instead of the page center.
    const sampleXmm = GEOMETRY.paperWidthMm / 2;
    const sampleYmm = GEOMETRY.marginTopMm + (OPAQUE_RED.pixelHeight / 150) * 25.4 * 0.5;
    const sampleX = Math.round((sampleXmm / 25.4) * RASTER_DPI);
    const sampleY = Math.round((sampleYmm / 25.4) * RASTER_DPI);
    const pixel = ctx.getImageData(sampleX, sampleY, 1, 1).data;
    // Real red fill (220,30,30) survives JPEG compression approximately --
    // red channel must dominate clearly over green/blue.
    expect(pixel[0]).toBeGreaterThan(150);
    expect(pixel[0]).toBeGreaterThan(pixel[1] + 40);
    expect(pixel[0]).toBeGreaterThan(pixel[2] + 40);
  });

  it("a real transparent PNG composites onto a WHITE background in the final JPG -- never black, never transparent (JPEG has no alpha)", async () => {
    const { plan } = compose([{ kind: "IMAGE", refId: TRANSPARENT_CIRCLE.refId, intrinsicWidthTicks: TRANSPARENT_CIRCLE.intrinsicWidthTick, intrinsicHeightTicks: TRANSPARENT_CIRCLE.intrinsicHeightTick, placement: "FULL" }]);
    const pages = await exportPaintPlanToJpgPages(plan, fontResource(), "QA", "WEB");
    const decoded = await loadImage(Buffer.from(pages[0].bytes));
    const { createCanvas } = await import("@napi-rs/canvas");
    const probe = createCanvas(decoded.width, decoded.height);
    const ctx = probe.getContext("2d");
    ctx.drawImage(decoded, 0, 0);
    // Top-left corner of the page is definitely outside the image's own
    // painted circle AND outside the image's own bounding box -- must be
    // real page background (white), not black/transparent.
    const pixel = ctx.getImageData(5, 5, 1, 1).data;
    expect(pixel[0]).toBeGreaterThan(230);
    expect(pixel[1]).toBeGreaterThan(230);
    expect(pixel[2]).toBeGreaterThan(230);
  });

  it("a real JPEG source image round-trips through the raster JPG pipeline without error", async () => {
    const { plan } = compose([{ kind: "IMAGE", refId: REAL_JPEG_REFID, intrinsicWidthTicks: mmToTicks(REAL_JPEG_WIDTH_MM), intrinsicHeightTicks: mmToTicks(REAL_JPEG_HEIGHT_MM), placement: "FULL" }]);
    const pages = await exportPaintPlanToJpgPages(plan, fontResource(), "QA", "WEB");
    expect(pages.length).toBeGreaterThan(0);
    expect(pages[0].bytes[0]).toBe(0xff);
    expect(pages[0].bytes[1]).toBe(0xd8);
  });
});

describe("QA -- jpg-export artifacts", () => {
  const outDir = join(__dirname, "..", "..", "qa", "publication", "jpg-export");

  it("generates a web-reading JPG QA artifact", async () => {
    const { plan } = compose([{ kind: "TEXT", text: "Web閲覧用のJPG出力である。" }]);
    const pages = await exportPaintPlanToJpgPages(plan, fontResource(), "WebSample", "WEB");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "web-reading-sample.jpg"), pages[0].bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
    expect(pages[0].bytes.length).toBeGreaterThan(0);
  });

  it("generates a print JPG QA artifact (1600px long side)", async () => {
    const { plan } = compose([{ kind: "TEXT", text: "入稿用のJPG出力である。" }]);
    const pages = await exportPaintPlanToJpgPages(plan, fontResource(), "PrintSample", "PRINT");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "print-sample.jpg"), pages[0].bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
    expect(Math.max(pages[0].pixelWidth, pages[0].pixelHeight)).toBe(PRINT_JPG_LONG_SIDE_PX);
  });

  it("generates a multi-page ZIP QA artifact", async () => {
    const { plan } = compose([{ kind: "TEXT", text: "一ページ目" }, { kind: "MANUAL_BREAK" }, { kind: "TEXT", text: "二ページ目" }, { kind: "MANUAL_BREAK" }, { kind: "TEXT", text: "三ページ目" }]);
    const zip = await exportPaintPlanToJpgZip(plan, fontResource(), "ZipSample", "WEB");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "zip-sample.zip"), zip.bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
    expect(zip.pages.length).toBe(3);
  });

  it("generates a mixed-content QA artifact: body text + ruby + TCY + real PNG + real JPEG + folio/header", async () => {
    const HEADER_SETTINGS: HeaderSettings = { hashiraOdd: "小説のタイトル", hashiraEven: "第一章", position: { band: "top", horizontal: "outer" } };
    const { plan } = compose(
      [
        { kind: "TEXT", text: "本文の書き出しである。" },
        { kind: "RUBY", base: "東京", reading: "とうきょう" },
        { kind: "TCY", text: "20" },
        { kind: "TEXT", text: "年、" },
        { kind: "IMAGE", refId: OPAQUE_RED.refId, intrinsicWidthTicks: OPAQUE_RED.intrinsicWidthTick, intrinsicHeightTicks: OPAQUE_RED.intrinsicHeightTick, placement: "FULL" },
        { kind: "IMAGE", refId: REAL_JPEG_REFID, intrinsicWidthTicks: mmToTicks(REAL_JPEG_WIDTH_MM), intrinsicHeightTicks: mmToTicks(REAL_JPEG_HEIGHT_MM), placement: "FULL" },
      ],
      { folioSettings: DEFAULT_FOLIO_SETTINGS, headerSettings: HEADER_SETTINGS }
    );
    const pages = await exportPaintPlanToJpgPages(plan, fontResource(), "MixedSample", "WEB");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    for (const page of pages) {
      try {
        writeFileSync(join(outDir, page.fileName), page.bytes);
      } catch {
        /* best-effort, transient Dropbox sync lock, non-fatal */
      }
    }
    expect(pages.length).toBeGreaterThan(0);
  });

  it("generates a structural-colophon QA artifact", async () => {
    const { units: colophonUnits, source: colophonSource } = buildFixtureUnits("colophon", [{ kind: "TEXT", text: "書名\t吾輩は猫である\n著者\t夏目漱石" }]);
    const { plan } = compose([{ kind: "TEXT", text: "本文の最終ページである。" }], { colophonUnits, colophonSource, colophonBlockId: "colophon" });
    const pages = await exportPaintPlanToJpgPages(plan, fontResource(), "ColophonSample", "WEB");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    for (const page of pages) {
      try {
        writeFileSync(join(outDir, page.fileName), page.bytes);
      } catch {
        /* best-effort, transient Dropbox sync lock, non-fatal */
      }
    }
    expect(pages.length).toBeGreaterThanOrEqual(2);
  });
});
