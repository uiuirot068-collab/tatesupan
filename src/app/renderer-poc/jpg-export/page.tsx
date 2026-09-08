"use client";

/**
 * TateSpun v2 Publication JPG Export -- Browser Production PoC
 *
 * Isolated PoC, same convention as `../page.tsx`'s own top-of-file
 * disclosure: NOT connected to the real Editor/manuscript/export flow.
 * Its job is narrower and different from that page's: prove that the
 * real v2 Publication pipeline (Core composition -> Publication Paint
 * Model -> the SAME PaintPlan the PDF/Node-QA paths already use) can be
 * rendered to a real JPG entirely in the browser, using native Canvas 2D
 * (`typesetting-v2/renderer/publication/rasterGeneratorBrowser.ts`), and
 * that a real user can trigger and download that JPG from the real
 * deployed app -- closing the "engine exists but nothing can execute it"
 * gap identified by the JPG Export product-runtime-integration audit.
 *
 * Wiring this into the real manuscript Editor/PreviewPane export buttons
 * is explicitly OUT of scope here: that requires a real "Editor content
 * string + PageSettings -> v2 Core LogicalUnit[]/composeCanonicalDocument"
 * bridge, which does not exist anywhere yet for PDF either (a separate,
 * much larger, not-yet-authorized task -- see the compatibility matrix's
 * own "Export migration" roadmap item). This page proves the BROWSER
 * EXECUTION PATH itself is real and working in the real app/bundle,
 * using a small fixed demo manuscript instead of live Editor content.
 *
 * Composition here uses `createFakeMeasurementProvider` (deterministic,
 * synthetic per-character advance) -- the same convention this whole v2
 * test suite already relies on for non-final-typography-fidelity
 * purposes. This is a real, disclosed simplification: text is
 * legible/correctly laid out, but character widths are not derived from
 * the real Shippori Mincho font metrics (unlike jsPDF/Node-canvas paths,
 * which do use real font-derived metrics for the PDF/QA outputs).
 */
import { useMemo, useState } from "react";
import { saveAs } from "file-saver";
import JSZip from "jszip";
// Deliberately DEEP imports, never the `typesetting-v2/core` barrel
// (`core/index.ts`) -- the barrel re-exports EVERYTHING, including
// `createShipporiMinchoMeasurementProvider` (`core/measurement/shipporiMinchoProvider.ts`),
// which imports Node's `fs` at module scope. A real `next build` proved
// this fails the client bundle even when the Node-only export is never
// called -- Turbopack must still resolve every module the barrel
// re-exports. Importing only the specific submodules actually used
// avoids pulling that (or any other Node-only) file into this route at
// all.
import { composeCanonicalDocument } from "../../../../typesetting-v2/core/layout/assemble";
import { createFakeMeasurementProvider } from "../../../../typesetting-v2/core/measurement/fakeProvider";
import { DEFAULT_FOLIO_SETTINGS } from "../../../../typesetting-v2/core/folio";
import { DEFAULT_RULE_SET_V2 } from "../../../../typesetting-v2/core/rules/defaultRuleSet";
import { mmToTicks } from "../../../../typesetting-v2/core/geometry/tick";
import type { HeaderSettings } from "../../../../typesetting-v2/core/header";
import type { LogicalUnit } from "../../../../typesetting-v2/core/units";
import { buildPublicationDocument, type PublicationRenderContext } from "../../../../typesetting-v2/renderer/publication/paintModel";
import { buildPaintPlan, FALLBACK_BASELINE_RATIO, type PublicationPageGeometry } from "../../../../typesetting-v2/renderer/publication/pdfGenerator";
import { exportPaintPlanToBrowserJpgPages, type JpgExportMode } from "../../../../typesetting-v2/renderer/publication/rasterGeneratorBrowser";
import { buildPageJpgFileName, buildZipFileName } from "../../../../typesetting-v2/renderer/publication/jpgFilename";

const FONT_FAMILY = "Shippori Mincho"; // already loaded via Google Fonts in src/app/layout.tsx

const GEOMETRY: PublicationPageGeometry = { paperWidthMm: 105, paperHeightMm: 148, marginTopMm: 15, marginBottomMm: 12, marginRightMm: 15, marginLeftMm: 15 };

const DEMO_TITLE = "JPG書き出しPoC";

const DEMO_PARAGRAPHS = ["これはTateSpun v2 Publicationのブラウザ内JPG書き出しを確認するための実験ページである。", "本文はダミーの原稿であり、実際のエディタ内容とは接続されていない。"];

// Sequential TEXT LogicalUnits with real, correctly-offset SourceSpans --
// the same simple construction `tools/compare/fixtureBuilder.ts`'s own
// TEXT-piece handling does, inlined here to keep this page self-contained
// rather than importing a test-only fixture helper into `src/`.
function buildDemoUnits(blockId: string, paragraphs: string[]): { units: LogicalUnit[]; source: string } {
  let cursor = 0;
  let source = "";
  const units: LogicalUnit[] = [];
  paragraphs.forEach((text, i) => {
    const start = cursor;
    source += text;
    cursor += Array.from(text).length;
    units.push({ kind: "TEXT", span: { blockId, start, end: cursor }, text });
    if (i < paragraphs.length - 1) {
      const breakStart = cursor;
      source += "\n";
      cursor += 1;
      // The break unit's own span must own its real "\n" character range
      // (not a zero-width span) -- Core's boundary derivation requires
      // every source position to be owned by exactly one unit.
      units.push({ kind: "PARAGRAPH_BREAK", span: { blockId, start: breakStart, end: cursor } });
    }
  });
  return { units, source };
}

function buildDemoPlan() {
  const { units, source } = buildDemoUnits("body", DEMO_PARAGRAPHS);
  const bodyFontSizePt = 10.5;
  const perCellAdvanceTick = mmToTicks((bodyFontSizePt * 25.4) / 72);
  const settings = {
    bodyFontRef: "jpg-export-poc",
    bodyFontSizePt,
    lineExtentTicks: 20 * perCellAdvanceTick,
    linePitchTicks: perCellAdvanceTick,
    columnExtentTicks: 30 * perCellAdvanceTick,
    columnsPerPage: 1,
  };
  const measurement = createFakeMeasurementProvider();
  const headerSettings: HeaderSettings = { hashiraOdd: DEMO_TITLE, hashiraEven: DEMO_TITLE, position: { band: "top", horizontal: "outer" } };
  const document = composeCanonicalDocument({
    bodyUnits: units,
    ruleSet: DEFAULT_RULE_SET_V2,
    measurement,
    settings,
    folioSettings: DEFAULT_FOLIO_SETTINGS,
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
  const model = buildPublicationDocument("jpg-export-poc", DEMO_TITLE, document, units, source, ctx);
  return buildPaintPlan(model, true, GEOMETRY, FALLBACK_BASELINE_RATIO);
}

type Status = { kind: "idle" } | { kind: "busy"; label: string } | { kind: "done"; label: string } | { kind: "error"; message: string };

export default function JpgExportPocPage() {
  const plan = useMemo(() => buildDemoPlan(), []);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const runExport = async (mode: JpgExportMode, action: "single" | "zip") => {
    setStatus({ kind: "busy", label: `${mode === "PRINT" ? "印刷用" : "Web閲覧用"}JPGを生成中…` });
    try {
      const pages = await exportPaintPlanToBrowserJpgPages(plan, FONT_FAMILY, (pageNumber) => buildPageJpgFileName(DEMO_TITLE, pageNumber), mode);
      if (action === "single") {
        pages.forEach((page) => saveAs(page.blob, page.fileName));
      } else {
        const zip = new JSZip();
        for (const page of pages) zip.file(page.fileName, page.blob);
        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, buildZipFileName(DEMO_TITLE));
      }
      setStatus({ kind: "done", label: `${pages.length}ページのJPGを書き出した。` });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "JPG書き出しに失敗した。" });
    }
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 640 }}>
      <h1>TateSpun v2 Publication -- JPG書き出し ブラウザPoC</h1>
      <p style={{ color: "#555" }}>
        実際のEditor/原稿とは接続されていない、独立した検証ページである。v2 Publication Paint
        Model（PDF出力と同じPaintPlan）をブラウザ標準Canvas 2Dで実際にJPGへ変換し、ダウンロードできることを確認する。
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1.5rem" }}>
        <button onClick={() => runExport("WEB", "single")}>Web閲覧用JPGをダウンロード</button>
        <button onClick={() => runExport("PRINT", "single")}>印刷用JPGをダウンロード（長辺1600px）</button>
        <button onClick={() => runExport("WEB", "zip")}>全ページをZIPでダウンロード</button>
      </div>
      <p style={{ marginTop: "1.5rem" }}>
        {status.kind === "idle" && "未実行"}
        {status.kind === "busy" && status.label}
        {status.kind === "done" && status.label}
        {status.kind === "error" && `エラー: ${status.message}`}
      </p>
    </main>
  );
}
