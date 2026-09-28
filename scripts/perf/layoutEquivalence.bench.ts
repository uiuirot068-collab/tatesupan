/**
 * Layout output-equivalence snapshot (NOT part of any test suite). Composes a
 * fixed fixture × paper-settings matrix through the real Editor bridge and
 * records a SHA-256 of every layout product, so two source trees (e.g. a
 * baseline checkout and an optimized one) can be compared exactly:
 *
 *   canonical document pages / trace / colophon / pageSequence / errors,
 *   LogicalUnits + source map, the Publication model, the fast PaintPlan,
 *   the font-aware PDF/JPG PaintPlan (the export worker's builder, page by
 *   page), the Preview paint document (full and live), the Preview page model.
 *
 * Hashes use a key-sorted canonical serialization (typed arrays → arrays,
 * Map/Set → sorted entries); nothing is excluded — the pipeline has no
 * timestamps or random values.
 *
 * Run: TATESPUN_EQ_OUT=<file.json> npx vitest run --config scripts/perf/vitest.config.ts layoutEquivalence
 * Env: TATESPUN_EQ_ONLY=<case,case> restricts cases; TATESPUN_EQ_HEAVY=0 skips 300k/50k.
 * Compare two outputs with scripts/perf/compareLayoutEquivalence.mjs.
 */
import { createHash, type Hash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { it } from "vitest";
import { computePageLayout, DEFAULT_PAGE_SETTINGS, deriveMaxCapacityFromMargins, type PageSettings, type PaperSizeKey } from "@/lib/pageLayout";
import { applyColumnCountPreset, applyDestinationPaperPreset } from "@/lib/paperPresets";
import { composeV2Document } from "@/lib/v2Bridge/composeV2Document";
import { buildV2PreviewDocument } from "@/lib/v2Bridge/buildV2PreviewDocument";
import { buildLivePreviewDocument } from "@/lib/v2Bridge/previewWorkerProtocol";
import { buildV2PreviewPageModel } from "@/lib/v2Bridge/previewPageModel";
import { createShipporiMinchoMeasurementProvider } from "../../typesetting-v2/core/measurement/shipporiMinchoProvider";
import { createPublicationPaintPlanBuilder, preparePublicationFontPaintContext } from "../../typesetting-v2/renderer/publication/pdfGenerator";
import type { ImageResolver } from "../../typesetting-v2/renderer/publication/paintModel";
import { prose, representative300k, singleParagraph, splitParagraphs } from "./longParagraph.bench";

const OUT = process.env.TATESPUN_EQ_OUT;
const run = OUT ? it : it.skip;
const HEAVY = process.env.TATESPUN_EQ_HEAVY !== "0";
const ONLY = process.env.TATESPUN_EQ_ONLY?.split(",");

// ---- canonical streaming hash ----
class StableHasher {
  private buffer = "";
  constructor(private readonly hash: Hash = createHash("sha256")) {}
  private write(text: string) {
    this.buffer += text;
    if (this.buffer.length > 1 << 16) {
      this.hash.update(this.buffer);
      this.buffer = "";
    }
  }
  value(input: unknown): this {
    if (input === null || input === undefined) this.write("null");
    else if (typeof input === "number") this.write(Number.isFinite(input) ? String(Object.is(input, -0) ? 0 : input) : `"${input}"`);
    else if (typeof input === "string") this.write(JSON.stringify(input));
    else if (typeof input === "boolean") this.write(input ? "true" : "false");
    else if (typeof input === "function") this.write('"<fn>"');
    else if (ArrayBuffer.isView(input)) this.value(Array.from(input as unknown as ArrayLike<number>));
    else if (Array.isArray(input)) {
      this.write("[");
      input.forEach((item, i) => {
        if (i > 0) this.write(",");
        this.value(item);
      });
      this.write("]");
    } else if (input instanceof Map) this.value(Array.from(input.entries()).sort(([a], [b]) => (String(a) < String(b) ? -1 : 1)));
    else if (input instanceof Set) this.value(Array.from(input).sort());
    else {
      const record = input as Record<string, unknown>;
      const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort();
      this.write("{");
      keys.forEach((key, i) => {
        if (i > 0) this.write(",");
        this.write(`${JSON.stringify(key)}:`);
        this.value(record[key]);
      });
      this.write("}");
    }
    return this;
  }
  digest(): string {
    this.hash.update(this.buffer);
    this.buffer = "";
    return this.hash.digest("hex").slice(0, 24);
  }
}
const sha = (value: unknown) => new StableHasher().value(value).digest();

// ---- settings matrix ----
const deriveCapacity = (settings: PageSettings): PageSettings => ({
  ...settings,
  ...deriveMaxCapacityFromMargins({
    paperSize: settings.paperSize,
    marginTop: settings.marginTop,
    marginBottom: settings.marginBottom,
    marginGutter: settings.marginGutter,
    marginOuter: settings.marginOuter,
    fontSizePt: settings.fontSizePt,
    lineHeightRatio: settings.lineHeightRatio,
    columnCount: settings.columnCount,
    columnGapMm: settings.columnGapMm,
  }),
});
function paper(key: PaperSizeKey, columns: 1 | 2 = 1): PageSettings {
  const withPaper = deriveCapacity(applyDestinationPaperPreset(DEFAULT_PAGE_SETTINGS, key));
  return columns === 1 ? withPaper : deriveCapacity(applyColumnCountPreset(withPaper, columns));
}
const withColophon = (settings: PageSettings): PageSettings => ({ ...settings, colophon: { ...settings.colophon, enabled: true, freeText: "奥付の自由記述。\n二行目。" } });
const nombreHidden = (settings: PageSettings): PageSettings => ({ ...settings, masterPage: { ...settings.masterPage, nombrePosition: "hidden" } });
const withHashira = (settings: PageSettings): PageSettings => ({
  ...settings,
  masterPage: { ...settings.masterPage, hashiraOdd: "作品名", hashiraEven: "章名", hideNombreOnFirstPage: true },
  pageOverrides: { 2: { hideNombre: true }, 3: { hideHashira: true }, 4: { hashiraOverride: "上書き柱" } },
});

const SETTINGS: Record<string, PageSettings> = {
  default: DEFAULT_PAGE_SETTINGS,
  bunko: paper("文庫"),
  a5_1: paper("A5", 1),
  a5_2: paper("A5", 2),
  shinsho: paper("新書"),
  b6: paper("B6"),
  a6: paper("A6"),
  "a5_2+colophon": withColophon(paper("A5", 2)),
  "default+colophon": withColophon(DEFAULT_PAGE_SETTINGS),
  "default+nombreHidden": nombreHidden(DEFAULT_PAGE_SETTINGS),
  "default+hashira+overrides": withHashira(DEFAULT_PAGE_SETTINGS),
};
const ALL_PAPERS = ["default", "bunko", "a5_1", "a5_2", "shinsho", "b6", "a6"];
const FURNITURE = ["a5_2+colophon", "default+colophon", "default+nombreHidden", "default+hashira+overrides"];

// ---- fixtures ----
const PUNCT = "「えっ、本当に？」と彼女は言った。『まさか――』（いや、違う）……〈それでも〉【注】、。！？・：；ー〜「」『』（）［］｛｝〔〕“引用”‘単’ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ々〻ゝゞヽヾ。";
const RUBY = "｜硝子《がらす》の瓶と石畳《いしだたみ》、|東京《とうきょう》の空。紫陽花《あじさい》が咲く。｜長い親文字列《ながいおやもじれつ》も。";
const BOUTEN = "《《確かに》》それは《《静かな》》夜で、《《｜硝子《がらす》の音》》がした。";
const TCY = "令和[tate]8[/tate]年12月25日、[tate]A5[/tate]判で!!と?!を書く。第[tate]100[/tate]号。";
const LATIN = "ABC abc 123 Hello, world. TateSpun v2.0 — iPhone 15 Pro、URL https://example.com/path?q=1 を含む。";
const SURROGATE = "𠮷野家の𩸽を食べた👨‍👩‍👧家族🇯🇵。é（é）と葛\u{E0100}城、👍🏽と❤️。";
const DASH = "それは――突然だった……。ああ‥‥そう。――――長い。…………";
const IMAGES = "画像の前の本文。\n【IMG:img-a:40:30:center】\n画像の間の本文。\n【IMG:img-b:30:60:top】\n【IMG:img-c:20:20:bottom】\n全面画像の前。\n【IMG:img-d:100:140:full】\n全面画像の後の本文。";
const PAGEBREAK = "第一章の本文。\n【改ページ】\n第二章の本文。\n\n\n空行の後。\n【改ページ】\n【改ページ】\n連続改ページ後。";

function mixedLongParagraph(length: number): string {
  const pieces = [prose(300), PUNCT, RUBY, BOUTEN, TCY, LATIN, SURROGATE, DASH];
  let text = "　";
  for (let i = 0; text.length < length; i++) text += pieces[i % pieces.length];
  return text;
}

/** Paragraph lengths sweeping every remainder around line/page capacity. */
function boundarySweep(settings: PageSettings): string {
  const layout = computePageLayout(settings);
  const perLine = Math.max(1, Math.floor(settings.charsPerLine));
  const perPage = perLine * layout.linesPerPage;
  const lengths: number[] = [];
  for (let d = -2; d <= 2; d++) lengths.push(perLine + d, perLine * 2 + d, perPage + d, perPage - perLine + d, 1, 2);
  return lengths.map((n, i) => "　" + prose(Math.max(1, n), i)).join("\n");
}

const BASE = Array.from({ length: 60 }, (_, i) => `　${prose(40 + (i % 7) * 23, i)}`).join("\n");

interface Case { name: string; content: string; settings: string[]; heavy?: boolean }
const CASES: Case[] = [
  { name: "01-normal", content: BASE, settings: [...ALL_PAPERS, ...FURNITURE] },
  { name: "02-single-20k", content: singleParagraph(20_000), settings: ["default", "a5_2", "shinsho"] },
  { name: "03-300k", content: representative300k(0), settings: ["default"], heavy: true },
  { name: "03b-300k-with-20k-paragraph", content: representative300k(20_000), settings: ["default", "a5_2"], heavy: true },
  { name: "04-punctuation", content: Array.from({ length: 30 }, () => PUNCT).join("\n") + "\n" + PUNCT.repeat(40), settings: ALL_PAPERS },
  { name: "05-ruby", content: Array.from({ length: 30 }, () => RUBY).join("\n") + "\n" + RUBY.repeat(40), settings: ALL_PAPERS },
  { name: "06-bouten", content: Array.from({ length: 30 }, () => BOUTEN).join("\n") + "\n" + BOUTEN.repeat(40), settings: ALL_PAPERS },
  { name: "07-tcy", content: Array.from({ length: 30 }, () => TCY).join("\n") + "\n" + TCY.repeat(40), settings: ALL_PAPERS },
  { name: "08-latin", content: Array.from({ length: 30 }, () => LATIN).join("\n") + "\n" + LATIN.repeat(40), settings: ALL_PAPERS },
  { name: "09-pagebreak", content: `${BASE}\n【改ページ】\n${PAGEBREAK}\n${prose(3000)}【改ページ】${prose(500)}`, settings: [...ALL_PAPERS, ...FURNITURE] },
  { name: "10-images", content: `${IMAGES}\n${BASE}\n【IMG:img-e:40:30:center】\n${prose(4000)}`, settings: [...ALL_PAPERS, "a5_2+colophon"] },
  { name: "15-colophon-only-text", content: prose(200), settings: FURNITURE },
  { name: "18-paragraph-boundary-sweep-default", content: boundarySweep(DEFAULT_PAGE_SETTINGS), settings: ["default", "default+colophon"] },
  { name: "18-paragraph-boundary-sweep-a5_2", content: boundarySweep(paper("A5", 2)), settings: ["a5_2"] },
  { name: "19-long-continuous-mixed", content: mixedLongParagraph(20_000), settings: ["default", "a5_2", "shinsho"] },
  { name: "19b-long-continuous-mixed-in-document", content: `${BASE}\n${mixedLongParagraph(12_000)}\n${BASE}`, settings: ["default", "a5_1"] },
  { name: "19c-kinsoku-run", content: "　" + prose(200) + "ー".repeat(120) + prose(200) + "。".repeat(60) + prose(100), settings: ["default", "a5_2"] },
  { name: "20-surrogate-emoji", content: Array.from({ length: 20 }, () => SURROGATE).join("\n") + "\n" + SURROGATE.repeat(60), settings: ALL_PAPERS },
  { name: "21-dash-ellipsis", content: Array.from({ length: 20 }, () => DASH).join("\n") + "\n" + DASH.repeat(60), settings: ALL_PAPERS },
  { name: "22-single-5k", content: singleParagraph(5000), settings: ["default", "a5_2"] },
  { name: "22-single-50k", content: singleParagraph(50_000), settings: ["default"], heavy: true },
  { name: "23-split-20k", content: splitParagraphs(20_000), settings: ["default", "a5_2"] },
  { name: "24-empty-and-tiny", content: "", settings: ["default"] },
  { name: "24b-tiny", content: "あ", settings: ["default", "a5_2+colophon"] },
  { name: "25-crlf-and-blank-lines", content: `一行目\r\n\r\n\r\n三行目。${RUBY}\r\n${prose(800)}\n\n`, settings: ["default"] },
];

const PNG_1x1 = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const imageResolver: ImageResolver = (refId) => ({ kind: "RESOLVED", url: `data:${refId}`, bytes: PNG_1x1, format: "PNG", pixelWidth: 1, pixelHeight: 1 });

function lineStats(pages: { columns: { lines: { placedUnits: unknown[] }[] }[] }[]) {
  let columns = 0;
  let lines = 0;
  let placed = 0;
  for (const page of pages) {
    columns += page.columns.length;
    for (const column of page.columns) {
      lines += column.lines.length;
      for (const line of column.lines) placed += line.placedUnits.length;
    }
  }
  return { columns, lines, placed };
}

run("layout equivalence snapshot", () => {
  const measurement = createShipporiMinchoMeasurementProvider(resolve("public/fonts/ShipporiMincho-Regular.ttf"));
  const fontBytes = readFileSync(resolve("public/fonts/ShipporiMincho-Regular.ttf"));
  const fontContext = preparePublicationFontPaintContext({ fileName: "ShipporiMincho-Regular.ttf", fontName: "Shippori Mincho", base64: fontBytes.toString("base64") });
  const results: Record<string, unknown> = {};
  for (const fixture of CASES) {
    if (fixture.heavy && !HEAVY) continue;
    for (const settingsName of fixture.settings) {
      const name = `${fixture.name}@${settingsName}`;
      if (ONLY && !ONLY.some((only) => name.includes(only))) continue;
      const started = performance.now();
      const bridge = composeV2Document({ title: "Equivalence", content: fixture.content, settings: SETTINGS[settingsName], measurement, imageResolver });
      const composeMs = performance.now() - started;
      const document = bridge.document;
      let fontPlan: string;
      try {
        const builder = createPublicationPaintPlanBuilder(bridge.model, fontContext.fontResource, bridge.pageGeometry, "EQ", fontContext);
        const hasher = new StableHasher();
        for (let i = 0; i < builder.pageCount; i++) hasher.value(builder.pageAt(i));
        fontPlan = hasher.digest();
      } catch (error) {
        fontPlan = `REFUSED:${(error as Error).message}`;
      }
      const record = {
        summary: {
          chars: fixture.content.length,
          pages: document.pages.length,
          colophonPages: document.colophon?.pages.length ?? 0,
          ...lineStats(document.pages),
          units: bridge.units.length,
          errors: document.errors.map((error) => JSON.stringify(error)),
          hold: document.hold ?? null,
        },
        hashes: {
          documentPages: sha(document.pages),
          documentTrace: sha(document.trace),
          documentColophon: sha(document.colophon ?? null),
          documentRest: sha({ pageSequence: document.pageSequence, version: document.version, warnings: document.warnings, errors: document.errors, hold: document.hold }),
          units: sha(bridge.units),
          source: sha({ source: bridge.source, map: bridge.bodySourceMap, colophonUnits: bridge.colophonUnits ?? null, colophonSource: bridge.colophonSource ?? null }),
          publicationModel: sha(bridge.model),
          fastPaintPlan: sha(bridge.plan),
          fontPaintPlanPdfJpg: fontPlan,
          previewDocument: sha(buildV2PreviewDocument(bridge, {})),
          livePreviewDocument: sha(buildLivePreviewDocument(bridge)),
          previewPageModel: sha(buildV2PreviewPageModel(bridge, fixture.content)),
        },
        composeMs: Math.round(composeMs),
      };
      results[name] = record;
      console.log(`${name}: pages=${record.summary.pages} lines=${record.summary.lines} compose=${record.composeMs}ms`);
    }
  }
  writeFileSync(OUT!, JSON.stringify(results, null, 1) + "\n");
});
