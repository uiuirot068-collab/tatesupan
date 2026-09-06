// P3-O09 — Preview Renderer Foundation: paint-only React painter.
//
// REUSE CONCEPT ONLY from tools/preview-dev-adapter/PreviewApp.tsx: absolute
// positioning everywhere content is placed, and a pure-CSS checkbox-driven
// toggle with zero client-side JavaScript. Re-derived here, not imported —
// this module has no dependency on the Stage D tool package.
//
// NEW in this foundation (per the P3-O09 task's explicit instruction that
// Stage D's dev-only appearance must not become the final Renderer's
// default look): a real NORMAL/DEBUG mode split. NORMAL renders plain
// typographic content only — no debug borders, no source-span labels, no
// "provisional" badges. DEBUG additionally exposes page/column/line order,
// source span, unit kind, GeometryTick coordinates, paragraph-start/
// manual-break flags, and provisional/ruby-annotation-pending state.

import type { PaintColumn, PaintDocument, PaintLine, PaintPage, PaintPlacedUnit } from "./paintModel";

export type PreviewMode = "normal" | "debug";

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: "Hiragino Mincho ProN", "Yu Mincho", serif; margin: 0; padding: 20px; background: #fafafa; color: #111; }
  h1 { font-size: 16px; }
  .fixture { border-top: 4px solid #333; padding-top: 12px; margin-bottom: 40px; }
  .fixture h2 { font-size: 13px; margin: 0 0 6px 0; }
  .meta { font-size: 11px; color: #666; margin-bottom: 8px; }
  .hold-banner { background: #fee; border: 1px solid #c0392b; padding: 8px; font-size: 12px; }
  .font-warning { background: #ffe9c2; border: 1px solid #cc8b00; padding: 6px; font-size: 11px; margin-bottom: 6px; }
  .page-row { display: flex; flex-wrap: wrap; gap: 24px; }
  .page { position: relative; background: #fff; writing-mode: vertical-rl; border: 1px solid #ccc; }
  .page.horizontal { writing-mode: horizontal-tb; }
  .column { position: absolute; top: 0; }
  .line { position: absolute; top: 0; }
  /* P3-O09-PAGE-CONTENT-CLIPPING-HOLD: heightPx is deliberately a tight,
     zero-margin fit (equal to fontSizePx, same tick-to-px conversion as
     everything else -- Natural Pitch places content with no stretch, so a
     full line's last character's bottom edge lands EXACTLY on the page's
     own bottom edge). The browser's DEFAULT line-height for the body's
     CJK serif stack is taller than font-size (often ~1.15-1.5x depending
     on the resolved font), so without line-height:1 each glyph's own
     rendered line box overflows this tightly-fitted box, and
     overflow:hidden clips the excess -- cumulatively reading as "page
     content is missing" even though every coordinate is correct (proven
     by the no-overflow assertions this HOLD added). writing-mode is also
     set explicitly here (not left to inherit from .page) and
     white-space:nowrap prevents a multi-code-point grapheme from ever
     wrapping inside its own box. Mirrors the already Human-approved
     Stage D .unit rule (tools/preview-dev-adapter/PreviewApp.tsx), which
     this foundation's own rewrite dropped these three properties from.
     NOTE: overflow:hidden itself moved to .unit-ink below
     (P3-O09-RUBY-ANNOTATION-MISSING-HOLD) -- .unit itself no longer
     clips, since a ruby annotation is painted deliberately OUTSIDE this
     box (left:100%) and must not be clipped by its own parent. */
  .unit { position: absolute; left: 0; right: 0; writing-mode: vertical-rl; line-height: 1; white-space: nowrap; text-align: center; }
  /* P3-O09-RUBY-ANNOTATION-MISSING-HOLD: the base glyph's own ink-clipping
     safety net (see the .unit comment above) now lives on this INNER
     wrapper instead of .unit itself. A ruby annotation is a SIBLING of
     this wrapper, not a descendant of it, so it is never subject to this
     clip -- CSS overflow only ever clips a box's own descendants, never
     its siblings, and moving the clip one level down is the minimal way
     to keep glyph-ink clipping while un-clipping the annotation. */
  .unit-ink { display: block; width: 100%; height: 100%; overflow: hidden; }
  .unit.kind-IMAGE .image-placeholder { width: 100%; height: 100%; background: repeating-linear-gradient(45deg, #ddd, #ddd 4px, #eee 4px, #eee 8px); border: 1px dashed #999; }
  .provisional-badge { display: none; }
  .ruby-annotation { position: absolute; left: 100%; margin-left: 2px; font-size: 0.55em; white-space: nowrap; color: #444; }

  /* DEBUG-mode-only decoration */
  .debug .page-label { position: absolute; top: -18px; left: 0; font-size: 11px; color: #555; }
  .debug .page-break-marker { position: absolute; top: -3px; left: 0; right: 0; border-top: 2px dashed #c0392b; }
  .debug .line { border-left: 1px dotted #ddd; }
  .debug .unit { outline: 1px solid rgba(0,0,0,0.12); }
  .debug .indent-marker { position: absolute; left: 0; right: 0; top: 0; background: repeating-linear-gradient(-45deg, #eee, #eee 3px, #f7f7f7 3px, #f7f7f7 6px); border-bottom: 1px dashed #bbb; }
  .debug .residual-marker { position: absolute; left: 0; right: 0; bottom: 0; background: rgba(0,150,0,0.06); border-top: 1px dashed #9c9; }
  .debug .provisional-badge { display: inline; font-size: 8px; color: #a00; background: #fee; padding: 0 2px; }
  .debug .ruby-annotation-pending { font-size: 8px; color: #06c; background: #eef6ff; padding: 0 2px; }
  .debug-info { display: none; position: absolute; left: 100%; top: 0; white-space: nowrap; font-size: 9px; background: #222; color: #0f0; padding: 1px 3px; z-index: 5; pointer-events: none; }
  .debug .debug-info { display: block; }
`;

function DebugBadge({ text }: { text: string }) {
  return <span className="debug-info">{text}</span>;
}

function UnitBox({ unit, fontSizePx, mode }: { unit: PaintPlacedUnit; fontSizePx: number; mode: PreviewMode }) {
  const debugText = `${unit.kind} [${unit.sourceSpan.start},${unit.sourceSpan.end}) y=${unit.debug.yTick} ${unit.heightIsApproximate ? "~h" : ""}`;
  const rubyDebugText =
    unit.rubyAnnotation?.status === "PLACED"
      ? `policy=${unit.rubyAnnotation.policy} offset=${unit.rubyAnnotation.offsetPx.toFixed(1)}px extent=${unit.rubyAnnotation.extentPx.toFixed(1)}px`
      : undefined;
  return (
    <div className={`unit kind-${unit.kind}`} style={{ top: unit.topPx, height: unit.heightPx, fontSize: fontSizePx }} title={mode === "debug" ? debugText : undefined}>
      {/* P3-O09-RUBY-ANNOTATION-MISSING-HOLD: the base glyph's own
          ink-clipping (overflow:hidden) lives on this inner wrapper, not
          on .unit itself, so a ruby annotation painted as .unit's own
          direct child (below, deliberately positioned OUTSIDE this
          wrapper's box) is never clipped by it — overflow only clips
          descendants, never siblings. */}
      <span className="unit-ink">
        {unit.kind === "IMAGE" ? <span className="image-placeholder" /> : unit.text}
        {unit.provisional && <span className="provisional-badge">prov</span>}
      </span>
      {/* Ruby Placement Micro-Loop: paints the annotation at Core's own
          canonical geometry (offset/extent), read-only — never
          recalculated, never re-centered here. Visible in NORMAL PREVIEW
          because it is real content (the reading text itself), not
          dev-only chrome; still explicitly not a claim of final
          Publication-quality optics (P3-O06 exact overhang values remain
          OPEN). */}
      {unit.rubyAnnotation?.status === "PLACED" && (
        <span
          className="ruby-annotation"
          style={{ top: unit.rubyAnnotation.offsetPx, height: unit.rubyAnnotation.extentPx }}
          title={mode === "debug" ? rubyDebugText : undefined}
        >
          {unit.rubyAnnotation.text}
        </span>
      )}
      {mode === "debug" && unit.rubyAnnotation?.status === "PENDING" && <span className="ruby-annotation-pending">annotation pending</span>}
      {mode === "debug" && <DebugBadge text={debugText} />}
    </div>
  );
}

function LineView({ line, fontSizePx, pageHeightPx, mode }: { line: PaintLine; fontSizePx: number; pageHeightPx: number; mode: PreviewMode }) {
  return (
    <div className="line" style={{ right: line.rightPx, width: line.widthPx, height: pageHeightPx }}>
      {mode === "debug" && <DebugBadge text={`line ${line.order}${line.indentPx !== undefined ? `, indent ${line.indentPx.toFixed(1)}px` : ""}`} />}
      {mode === "debug" && line.indentPx !== undefined && <div className="indent-marker" style={{ height: line.indentPx }} />}
      {line.units.map((unit) => (
        <UnitBox key={unit.id} unit={unit} fontSizePx={fontSizePx} mode={mode} />
      ))}
    </div>
  );
}

function ColumnView({ column, fontSizePx, pageHeightPx, mode }: { column: PaintColumn; fontSizePx: number; pageHeightPx: number; mode: PreviewMode }) {
  return (
    <div className="column" style={{ right: column.rightPx, width: column.widthPx, height: pageHeightPx }}>
      {mode === "debug" && <DebugBadge text={`col ${column.order}, residual ${column.residualSpacePx.toFixed(1)}px`} />}
      {column.lines.map((line) => (
        <LineView key={line.id} line={line} fontSizePx={fontSizePx} pageHeightPx={pageHeightPx} mode={mode} />
      ))}
    </div>
  );
}

export function PreviewPage({ page, fontSizePx, mode }: { page: PaintPage; fontSizePx: number; mode: PreviewMode }) {
  const rootClass = ["page", page.orientation === "horizontal" ? "horizontal" : "", mode === "debug" ? "debug" : ""].filter(Boolean).join(" ");
  return (
    <div className={rootClass} style={{ width: page.widthPx, height: page.heightPx }}>
      {mode === "debug" && (
        <span className="page-label">
          page {page.order}
          {page.manualBreakBefore ? " — manual break before" : ""}
        </span>
      )}
      {mode === "debug" && page.manualBreakBefore && <div className="page-break-marker" />}
      {page.columns.map((column) => (
        <ColumnView key={column.id} column={column} fontSizePx={fontSizePx} pageHeightPx={page.heightPx} mode={mode} />
      ))}
    </div>
  );
}

export function PreviewDocumentView({ model, mode }: { model: PaintDocument; mode: PreviewMode }) {
  return (
    <section className="fixture" id={model.id}>
      <h2>{model.label}</h2>
      {mode === "debug" && (
        <div className="meta">
          {model.renderedPageCount} of {model.totalPageCount} page(s) rendered
          {model.renderedPageCount < model.totalPageCount ? " (bounded page window)" : ""}
        </div>
      )}
      {model.fontIdentityMismatch && <div className="font-warning">FONT / MEASUREMENT IDENTITY MISMATCH — painted with a different font identity than the document was composed against; no remeasure performed.</div>}
      {model.hold ? (
        <div className="hold-banner">
          HOLD — this document did not compose cleanly and must not be treated as an approved layout.
          <ul>
            {model.holdReasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="page-row">
          {model.pages.map((page) => (
            <PreviewPage key={page.id} page={page} fontSizePx={model.fontSizePx} mode={mode} />
          ))}
          {model.colophonPages?.map((page) => (
            <PreviewPage key={page.id} page={page} fontSizePx={model.fontSizePx} mode={mode} />
          ))}
        </div>
      )}
    </section>
  );
}

export function PreviewFoundationArtifact({ models, mode }: { models: PaintDocument[]; mode: PreviewMode }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <title>TateSpun v2 — P3-O09 Preview Renderer Foundation</title>
        <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      </head>
      <body className={mode === "debug" ? "debug" : ""}>
        <h1>P3-O09 Preview Renderer Foundation — {mode === "debug" ? "DEBUG / INSPECTION" : "NORMAL PREVIEW"}</h1>
        <div className="app">
          {models.map((m) => (
            <PreviewDocumentView key={m.id} model={m} mode={mode} />
          ))}
        </div>
      </body>
    </html>
  );
}
