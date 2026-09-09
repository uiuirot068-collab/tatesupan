import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { PaintDocument } from "../../renderer/preview/paintModel";
import { PreviewDocumentView } from "../../renderer/preview/PreviewRenderer";
import { exportPaintPlanToBrowserJpgPages, type JpgExportMode } from "../../renderer/publication/rasterGeneratorBrowser";
import { buildPageJpgFileName, buildZipFileName } from "../../renderer/publication/jpgFilename";
import { createFakeMeasurementProvider } from "../../core/measurement/fakeProvider";
import { composeV2Document } from "../../../src/lib/v2Bridge/composeV2Document";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../../../src/lib/pageLayout";
import { ChecklistPanel } from "./ChecklistPanel";
import fontUrl from "../../qa/publication/p3-o08/font-poc/fonts/ShipporiMincho-Regular.ttf?url";

const SAMPLE = `人は驚きすぎると、本当に足が止まるらしい。
雨の匂いが残る道を、私はゆっくり歩いた。「ああ、ここだ」と声がした。
昨日のメモには｜縦書き《たてがき》の確認とある。
――それでも、物語はまだ続いている……。`;
const MEMO_STORAGE_KEY = "tatespun:v2:human-e2e-memo";
const FONT_FAMILY = "Shippori Mincho";

type SidePanel = "settings" | "memo" | "checklist" | null;
type History = { past: string[]; present: string; future: string[] };

interface EditorInput {
  title: string;
  content: string;
  fontSizePt: number;
  lineHeightRatio: number;
  charsPerLine: number;
  linesPerColumn: number;
}

function buildSettings(input: EditorInput): PageSettings {
  return {
    ...DEFAULT_PAGE_SETTINGS,
    paperSize: "A5",
    fontFamily: FONT_FAMILY,
    fontSizePt: input.fontSizePt,
    lineHeightRatio: input.lineHeightRatio,
    charsPerLine: input.charsPerLine,
    linesPerColumn: input.linesPerColumn,
    columnCount: 1,
    layoutMode: "capacity",
    masterPage: {
      ...DEFAULT_PAGE_SETTINGS.masterPage,
      nombrePosition: "hidden",
      hashiraOdd: input.title,
      hashiraEven: input.title,
    },
    pageOverrides: {},
    colophon: { ...DEFAULT_PAGE_SETTINGS.colophon, enabled: false },
  };
}

function App() {
  const [title, setTitle] = useState("TateSpun v2 Human E2E QA");
  const [history, setHistory] = useState<History>({ past: [], present: SAMPLE, future: [] });
  const [fontSize, setFontSize] = useState(9);
  const [lineHeight, setLineHeight] = useState(1.7);
  const [chars, setChars] = useState(54);
  const [lines, setLines] = useState(21);
  const [status, setStatus] = useState("準備できました");
  const [preview, setPreview] = useState<PaintDocument | null>(null);
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [memo, setMemo] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const content = history.present;
  const input = useMemo<EditorInput>(() => ({ title, content, fontSizePt: fontSize, lineHeightRatio: lineHeight, charsPerLine: chars, linesPerColumn: lines }), [title, content, fontSize, lineHeight, chars, lines]);
  const settings = useMemo(() => buildSettings(input), [input]);
  const bridge = useMemo(() => composeV2Document({ title, content, settings, measurement: createFakeMeasurementProvider() }), [title, content, settings]);

  useEffect(() => {
    setMemo(window.localStorage.getItem(MEMO_STORAGE_KEY) ?? "次の章の展開について：\n・伏線の回収位置を再確認\n・地の文と会話のリズムを見直す");
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidePanel(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const updateContent = (next: string) => {
    setHistory((current) => next === current.present ? current : { past: [...current.past, current.present], present: next, future: [] });
  };

  const undo = () => setHistory((current) => {
    const previous = current.past.at(-1);
    if (previous === undefined) return current;
    return { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] };
  });

  const redo = () => setHistory((current) => {
    const next = current.future[0];
    if (next === undefined) return current;
    return { past: [...current.past, current.present], present: next, future: current.future.slice(1) };
  });

  const insertPageBreak = () => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? start;
    const token = "\n【改ページ】\n";
    updateContent(content.slice(0, start) + token + content.slice(end));
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  async function updatePreview() {
    setStatus("Canonical Previewを組版中…");
    const response = await fetch("/api/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    if (!response.ok) throw new Error(await response.text());
    setPreview(await response.json());
    setStatus("Previewを更新しました");
  }

  useEffect(() => {
    void updatePreview().catch((error) => setStatus(`Previewエラー: ${error instanceof Error ? error.message : String(error)}`));
    // Initial real-font preview only; later updates are explicit to keep typing responsive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function exportPdf() {
    setStatus("v2 Publication PDFを生成中…");
    try {
      const response = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!response.ok) throw new Error(await response.text());
      saveAs(await response.blob(), `${title || "tatespun-v2"}.pdf`);
      setStatus("v2 Publication PDFを保存しました");
    } catch (error) {
      setStatus(`PDFエラー: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function exportJpg(mode: JpgExportMode, action: "first" | "zip") {
    const label = mode === "PRINT" ? "印刷用" : "Web閲覧用";
    setStatus(`${label}JPGをブラウザで生成中…`);
    try {
      const safeTitle = title.trim() || "tatespun-v2";
      const pages = await exportPaintPlanToBrowserJpgPages(bridge.plan, FONT_FAMILY, (page) => buildPageJpgFileName(safeTitle, page), mode);
      if (action === "first") {
        saveAs(pages[0].blob, pages[0].fileName);
      } else {
        const zip = new JSZip();
        for (const page of pages) zip.file(page.fileName, page.blob);
        saveAs(await zip.generateAsync({ type: "blob" }), buildZipFileName(safeTitle));
      }
      setStatus(`${label}JPG ${action === "first" ? "1ページ目" : `${pages.length}ページ`}を保存しました`);
    } catch (error) {
      setStatus(`JPGエラー: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const saveMemo = (value: string) => {
    setMemo(value);
    window.localStorage.setItem(MEMO_STORAGE_KEY, value);
  };

  return (
    <main>
      <style>{STYLE}</style>
      <header className="app-header">
        <div><h1>TateSpun v2</h1><p>開発専用・Canonical Preview / Publication確認</p></div>
        <span>Production未接続</span>
      </header>

      <nav className="toolbar" aria-label="Editor操作">
        <button type="button" onClick={undo} disabled={history.past.length === 0}><span aria-hidden>↶</span> 元に戻す</button>
        <button type="button" onClick={redo} disabled={history.future.length === 0}><span aria-hidden>↷</span> やり直す</button>
        <button type="button" disabled title="画像のProduction Editor配線は最終統合ゲートです">画像</button>
        <button type="button" onClick={insertPageBreak}><span aria-hidden>⏎</span> 改ページ</button>
        <button type="button" onClick={() => setSidePanel("memo")}>メモ</button>
        <button type="button" onClick={() => setSidePanel("checklist")}>完成前チェック</button>
        <span className="toolbar-spacer" />
        <button type="button" onClick={() => setSidePanel("settings")} aria-expanded={sidePanel === "settings"}><span aria-hidden>⚙️</span> 設定</button>
      </nav>

      <section className="workspace">
        <div className="editor-column">
          <label className="title-field"><span>作品名</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="editor"><span>原稿（横書き入力）</span><textarea ref={textareaRef} value={content} onChange={(event) => updateContent(event.target.value)} /></label>
          <div className="export-bar">
            <button type="button" onClick={() => void updatePreview().catch((error) => setStatus(`Previewエラー: ${error instanceof Error ? error.message : String(error)}`))}>Preview更新</button>
            <button type="button" onClick={() => void exportPdf()}>PDF</button>
            <button type="button" onClick={() => void exportJpg("WEB", "first")}>Web JPG・1ページ</button>
            <button type="button" onClick={() => void exportJpg("WEB", "zip")}>Web JPG・全ページZIP</button>
            <button type="button" onClick={() => void exportJpg("PRINT", "zip")}>印刷JPG・全ページZIP</button>
          </div>
          <output className="status" aria-live="polite">{status}</output>
        </div>
        <div className="preview" aria-label="縦書きPreview">{preview ? <PreviewDocumentView model={preview} mode="normal" /> : <p>Previewを読み込み中…</p>}</div>
      </section>

      {sidePanel && <button className="backdrop" type="button" aria-label="パネルを閉じる" onClick={() => setSidePanel(null)} />}

      {sidePanel === "settings" && (
        <aside className="side-panel" aria-labelledby="settings-title">
          <header className="panel-header"><div><p className="eyebrow">Editorを表示したまま変更</p><h2 id="settings-title">設定</h2></div><button className="icon-button" type="button" onClick={() => setSidePanel(null)} aria-label="設定を閉じる">×</button></header>
          <div className="panel-body">
            <label className="field"><span>本文サイズ（pt）</span><input type="number" min="6" max="30" step="0.5" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></label>
            <label className="field"><span>行送り</span><input type="number" min="1" max="3" step="0.05" value={lineHeight} onChange={(event) => setLineHeight(Number(event.target.value))} /></label>
            <label className="field"><span>字数</span><input type="number" min="5" max="100" value={chars} onChange={(event) => setChars(Number(event.target.value))} /></label>
            <label className="field"><span>行数</span><input type="number" min="1" max="60" value={lines} onChange={(event) => setLines(Number(event.target.value))} /></label>
            <p className="privacy-note">設定変更後は「Preview更新」でCanonical layoutを再生成します。</p>
          </div>
        </aside>
      )}

      {sidePanel === "memo" && (
        <aside className="side-panel" aria-labelledby="memo-title">
          <header className="panel-header"><div><p className="eyebrow">原稿とは別にローカル保存</p><h2 id="memo-title">メモ</h2></div><button className="icon-button" type="button" onClick={() => setSidePanel(null)} aria-label="メモを閉じる">×</button></header>
          <div className="panel-body memo-body"><textarea autoFocus value={memo} onChange={(event) => saveMemo(event.target.value)} /><p className="privacy-note">このブラウザのlocalStorageだけに保存されます。</p></div>
        </aside>
      )}

      {sidePanel === "checklist" && <ChecklistPanel onClose={() => setSidePanel(null)} />}
    </main>
  );
}

const STYLE = `
@font-face{font-family:"Shippori Mincho";src:url(${JSON.stringify(fontUrl)}) format("truetype");font-display:swap}
:root{font-family:system-ui,-apple-system,"Yu Gothic",sans-serif;color:#2c2823;background:#f3f0ea;--paper:#fffdf8;--panel:#fff;--border:#d8d0c4;--accent:#8f3028;--accent-soft:#f5e7e3}*{box-sizing:border-box}body{margin:0;background:#f3f0ea}button,input,select,textarea{font:inherit}button{cursor:pointer}.app-header{height:58px;padding:9px 18px;background:#2c2823;color:#fffdf8;display:flex;align-items:center;justify-content:space-between}.app-header h1{font:600 19px "Shippori Mincho",serif;margin:0;letter-spacing:.08em}.app-header p{font-size:11px;margin:2px 0 0;color:#ddd5ca}.app-header>span{font-size:11px;border:1px solid #786f65;border-radius:999px;padding:3px 9px}.toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 12px;background:#fff;border-bottom:1px solid var(--border);position:relative;z-index:2}.toolbar button,.export-bar button,.checklist-actions button,.wide-button{border:1px solid var(--border);background:#fff;border-radius:7px;padding:7px 10px;color:#2c2823}.toolbar button:hover,.export-bar button:hover,.checklist-actions button:hover,.wide-button:hover{background:var(--accent-soft)}button:disabled{cursor:not-allowed;opacity:.42}.toolbar-spacer{flex:1}.workspace{height:calc(100vh - 107px);display:grid;grid-template-columns:minmax(340px,38%) 1fr;gap:14px;padding:14px}.editor-column{display:flex;min-height:0;flex-direction:column;gap:8px}.title-field{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:10px;font-size:12px}.title-field input,.field input,.field select{width:100%;border:1px solid var(--border);border-radius:7px;background:#fff;padding:8px}.editor{display:flex;min-height:0;flex:1;flex-direction:column;gap:5px;font-size:12px}.editor textarea{min-height:260px;flex:1;width:100%;resize:none;border:1px solid var(--border);background:var(--paper);padding:16px;font:16px/1.8 "Shippori Mincho",serif;box-shadow:0 2px 8px #2c282312}.editor textarea:focus,.field input:focus,.field select:focus{outline:3px solid #8f302833;outline-offset:1px}.export-bar{display:flex;gap:6px;flex-wrap:wrap}.export-bar button{font-size:12px}.export-bar button:nth-child(2){background:#2c2823;color:white}.status{font-size:12px;color:#4c6b4f;min-height:18px}.preview{overflow:auto;background:#ddd7ce;padding:24px;min-height:400px}.preview .fixture{border:0;margin:0}.preview .fixture h2,.preview .meta{font-size:13px}.preview .page-row{display:flex;gap:20px}.preview .page{position:relative;background:#fff;border:1px solid #aaa;box-shadow:0 2px 8px #999;font-family:"Shippori Mincho",serif}.preview .column,.preview .line,.preview .unit{position:absolute;top:0}.preview .unit{left:0;right:0;writing-mode:vertical-rl;line-height:1;white-space:nowrap;text-align:center}.preview .unit-ink{display:block;width:100%;height:100%;overflow:hidden}.preview .ruby-annotation{position:absolute;left:100%;top:0;font-size:.5em;writing-mode:vertical-rl}.preview .tcy{text-combine-upright:all}.preview .dash-glyph{position:absolute;left:0;right:0}.preview .image-placeholder{width:100%;height:100%;background:#ddd}.backdrop{position:fixed;inset:0;border:0;background:#2c28234d;z-index:20}.side-panel{position:fixed;z-index:21;right:0;top:0;height:100vh;width:min(430px,100vw);background:#f8f5ef;box-shadow:-10px 0 32px #2c282333;display:flex;flex-direction:column}.panel-header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:#fff;padding:17px 20px}.panel-header h2{font:600 18px "Shippori Mincho",serif;margin:2px 0 0}.eyebrow{font-size:10px;letter-spacing:.08em;color:#766e64;margin:0;text-transform:uppercase}.icon-button{border:0;background:transparent;font-size:24px;line-height:1;padding:7px;color:#675f56}.panel-body{overflow:auto;padding:20px}.field{display:grid;gap:6px;margin-bottom:18px;font-size:13px}.privacy-note{border-left:3px solid #aaa198;padding-left:10px;color:#6b645d;font-size:11px;line-height:1.6}.memo-body{display:flex;flex:1;flex-direction:column}.memo-body textarea{min-height:300px;flex:1;resize:none;border:1px solid var(--border);background:var(--paper);padding:14px;font:15px/1.8 "Shippori Mincho",serif}.checklist-actions{display:flex;flex-wrap:wrap;gap:6px;margin:-6px 0 18px}.checklist-actions button{font-size:11px}.danger-text{color:#a32d2d!important}.completion{border-radius:7px;background:#eee8df;padding:8px 10px;font-size:12px}.completion.is-complete{background:#e1efe2;color:#285d32;font-weight:600}.checklist-items{display:grid;gap:8px;list-style:none;padding:0;margin:16px 0}.checklist-items li{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px}.checklist-items li>input[type=checkbox]{width:18px;height:18px;accent-color:var(--accent)}.checklist-items li>input[type=text],.checklist-items li>input:not([type]){width:100%;border:0;border-bottom:1px solid var(--border);background:transparent;padding:7px 4px}.checked-text{text-decoration:line-through;color:#777}.remove-item{border:0;background:transparent;color:#8c8379;font-size:18px}.wide-button{width:100%;font-size:12px}@media(max-width:880px){.workspace{height:auto;grid-template-columns:1fr}.editor textarea{min-height:360px}.preview{min-height:560px}}@media(max-width:600px){.app-header{padding-inline:12px}.app-header>span{display:none}.toolbar{gap:4px}.toolbar button{padding:7px;font-size:11px}.workspace{padding:9px}.export-bar button{flex:1 1 45%}}
`;

createRoot(document.getElementById("root")!).render(<App />);
