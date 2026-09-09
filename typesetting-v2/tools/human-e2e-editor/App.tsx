import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { PaintDocument } from "../../renderer/preview/paintModel";
import { PreviewDocumentView } from "../../renderer/preview/PreviewRenderer";
import fontUrl from "../../qa/publication/p3-o08/font-poc/fonts/ShipporiMincho-Regular.ttf?url";

const SAMPLE = `人は驚きすぎると、本当に足が止まるらしい。
スイはそれを初めて知った。数歩先へ行ったモルが振り返る。

知って、知って。
「ああ」
「あ？」
「あ！」
あ。」あ
あ、」あ
本当に足が止まるらしい――……。`;

function App() {
  const [content, setContent] = useState(SAMPLE);
  const [fontSize, setFontSize] = useState(9);
  const [lineHeight, setLineHeight] = useState(1.7);
  const [chars, setChars] = useState(54);
  const [lines, setLines] = useState(21);
  const [status, setStatus] = useState("Ready");
  const [preview, setPreview] = useState<PaintDocument | null>(null);
  const input = { content, fontSizePt: fontSize, lineHeightRatio: lineHeight, charsPerLine: chars, linesPerColumn: lines };
  async function updatePreview() { setStatus("Composing Canonical Preview…"); const response = await fetch("/api/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); if (!response.ok) throw new Error(await response.text()); setPreview(await response.json()); setStatus("Preview updated"); }
  useEffect(() => { void updatePreview().catch(error => setStatus(`Preview failed: ${error.message}`)); }, []);

  async function exportPdf() {
    setStatus("Generating real v2 Publication PDF…");
    try {
      const response = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "tatespun-v2-human-e2e.pdf";
      anchor.click();
      URL.revokeObjectURL(href);
      setStatus("Downloaded real v2 vector Publication PDF");
    } catch (error) {
      setStatus(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return <main>
    <style>{STYLE}</style>
    <header><h1>TateSpun v2 — Human E2E Editor Gate</h1><p>DEV ONLY · v2Bridge → Canonical Core → real Preview / Publication</p></header>
    <section className="controls">
      <label>Paper<input value="A5" disabled /></label>
      <label>Font<input value="Shippori Mincho Regular" disabled /></label>
      <label>Body pt<input type="number" min="6" max="30" step="0.5" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} /></label>
      <label>Line height<input type="number" min="1" max="3" step="0.05" value={lineHeight} onChange={e => setLineHeight(Number(e.target.value))} /></label>
      <label>Chars/line<input type="number" min="5" max="100" value={chars} onChange={e => setChars(Number(e.target.value))} /></label>
      <label>Lines/column<input type="number" min="1" max="60" value={lines} onChange={e => setLines(Number(e.target.value))} /></label>
      <button onClick={() => void updatePreview().catch(error => setStatus(`Preview failed: ${error.message}`))}>Update Preview</button>
      <button className="export" onClick={exportPdf}>Export v2 Vector PDF</button>
      <output>{status}</output>
    </section>
    <section className="workspace">
      <label className="editor"><strong>Manuscript</strong><textarea value={content} onChange={e => setContent(e.target.value)} /></label>
      <div className="preview">{preview ? <PreviewDocumentView model={preview} mode="normal" /> : <p>Loading Preview…</p>}</div>
    </section>
  </main>;
}

const STYLE = `
@font-face{font-family:"Shippori Mincho";src:url(${JSON.stringify(fontUrl)}) format("truetype");font-display:swap}
*{box-sizing:border-box}body{margin:0;background:#eee;color:#222;font-family:system-ui,sans-serif}main{padding:18px}header h1{margin:0;font-size:20px}header p{margin:4px 0 14px;color:#666}.controls{display:flex;gap:10px;align-items:end;flex-wrap:wrap;background:#fff;padding:12px;border:1px solid #ccc}.controls label{display:grid;gap:3px;font-size:12px}.controls input{width:116px;padding:5px}.controls button{padding:7px 12px}.controls .export{background:#111;color:#fff}.controls output{font-size:12px;color:#185b31}.workspace{display:grid;grid-template-columns:minmax(300px,36%) 1fr;gap:18px;margin-top:18px}.editor{display:grid;grid-template-rows:auto minmax(650px,1fr);gap:6px}.editor textarea{width:100%;padding:14px;font:16px/1.7 "Shippori Mincho",serif;resize:vertical}.preview{overflow:auto;background:#ddd;padding:24px;min-height:720px}.preview .fixture{border:0;margin:0}.preview .fixture h2,.preview .meta{font-size:13px}.preview .page-row{display:flex;gap:20px}.preview .page{position:relative;background:#fff;border:1px solid #aaa;box-shadow:0 2px 8px #999;font-family:"Shippori Mincho",serif}.preview .column,.preview .line,.preview .unit{position:absolute;top:0}.preview .unit{left:0;right:0;writing-mode:vertical-rl;line-height:1;white-space:nowrap;text-align:center}.preview .unit-ink{display:block;width:100%;height:100%;overflow:hidden}.preview .ruby-annotation{position:absolute;left:100%;top:0;font-size:.5em;writing-mode:vertical-rl}.preview .tcy{text-combine-upright:all}.preview .dash-glyph{position:absolute;left:0;right:0}.preview .image-placeholder{width:100%;height:100%;background:#ddd}@media(max-width:900px){.workspace{grid-template-columns:1fr}.editor{grid-template-rows:auto 360px}}
`;

createRoot(document.getElementById("root")!).render(<App />);
