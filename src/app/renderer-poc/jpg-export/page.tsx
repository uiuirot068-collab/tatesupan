"use client";

/**
 * TateSpun v2 Publication JPG Export -- Browser Production PoC
 *
 * Isolated PoC, same convention as `../page.tsx`'s own top-of-file
 * disclosure: NOT connected to the real Editor/manuscript state. Its job
 * is narrower and different from that page's: prove that the real v2
 * Publication pipeline (Core composition -> Publication Paint Model ->
 * the SAME PaintPlan the PDF/Node-QA paths already use) can be rendered
 * to a real JPG entirely in the browser, using native Canvas 2D
 * (`typesetting-v2/renderer/publication/rasterGeneratorBrowser.ts`), and
 * that a real user can trigger and download that JPG from the real
 * deployed app.
 *
 * Round 2 (Live Editor -> v2 Bridge): this page now composes through the
 * real `composeV2Document` bridge (`src/lib/v2Bridge/`) using the
 * Editor's own real `DEFAULT_PAGE_SETTINGS` (real 文庫 paper size, real
 * margins, real charsPerLine=39/linesPerColumn=15 -- the actual current
 * app default, not an arbitrary demo number) instead of this page's own
 * prior hand-rolled composition. This both closes an earlier Human
 * observation (the previous hardcoded 20-char demo capacity looked
 * visually tight -- not a renderer defect, simply not a real setting)
 * and gives a real, empirical (not just unit-tested) build-time proof
 * that the bridge is genuinely client-bundle-safe.
 *
 * Still NOT wired to live Editor manuscript content/title/images -- this
 * page's own manuscript text remains a small fixed demo string, passed
 * through the SAME real `buildV2UnitsFromManuscript` tokenizer the
 * bridge uses for any real manuscript. Wiring real Editor content itself
 * (title/content/images state) into a page is the next, separate,
 * trivial-by-comparison step once this bridge is Human-approved.
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
import { createFakeMeasurementProvider } from "../../../../typesetting-v2/core/measurement/fakeProvider";
import { composeV2Document } from "../../../lib/v2Bridge/composeV2Document";
import { DEFAULT_PAGE_SETTINGS } from "../../../lib/pageLayout";
import { exportPaintPlanToBrowserJpgPages, type JpgExportMode } from "../../../../typesetting-v2/renderer/publication/rasterGeneratorBrowser";
import { buildPageJpgFileName, buildZipFileName } from "../../../../typesetting-v2/renderer/publication/jpgFilename";

const FONT_FAMILY = "Shippori Mincho"; // already loaded via Google Fonts in src/app/layout.tsx

const DEMO_TITLE = "JPG書き出しPoC";

const DEMO_CONTENT = "これはTateSpun v2 Publicationのブラウザ内JPG書き出しを確認するための実験ページである。\n本文はダミーの原稿であり、実際のエディタ内容とは接続されていない。";

const DEMO_SETTINGS = {
  ...DEFAULT_PAGE_SETTINGS,
  masterPage: { ...DEFAULT_PAGE_SETTINGS.masterPage, hashiraOdd: DEMO_TITLE, hashiraEven: DEMO_TITLE },
};

function buildDemoPlan() {
  const measurement = createFakeMeasurementProvider();
  const { plan } = composeV2Document({ title: DEMO_TITLE, content: DEMO_CONTENT, settings: DEMO_SETTINGS, measurement });
  return plan;
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
        実際のEditor原稿本文とは接続されていないが、実際のEditor既定設定（文庫・39字×15行）を
        src/lib/v2Bridge 経由で使用している。v2 Publication Paint Model（PDF出力と同じPaintPlan）を
        ブラウザ標準Canvas 2Dで実際にJPGへ変換し、ダウンロードできることを確認する。
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
