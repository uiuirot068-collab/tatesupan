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
  /* P3-O03-TCY-VISUAL: text-combine-upright is the standard CSS mechanism
     for tategaki 縦中横 (Phase 2's own P2-L06B evidence already identified
     it as the correct approach — its logical model was always PASS; only
     full-page visual combination was left OPEN/unverified there). It
     combines the wrapped inline content horizontally within its own
     single em-box, scaling automatically per the CSS Writing Modes spec
     -- no manual scaleX/font-size/letter-spacing invented here, the
     browser's own built-in algorithm does the fitting. Applied only to
     the TCY unit's own text wrapper, never the surrounding vertical body
     text, and never to the .unit box itself (which must keep its normal
     writing-mode:vertical-rl so it still occupies the correct canonical
     GeometryTick-derived position along the line). */
  .tcy { text-combine-upright: all; }
  /* P3-O04-DASH-VISUAL: Phase 2's own frozen P2-L06 evidence measured a
     real, non-hypothetical optical problem for dash/ellipsis runs
     (glyph ink left-shifted within its own logical cell) and explicitly
     applied no correction, since no Human Product decision on the exact
     fix existed. Rather than relying on font-glyph ink at all (font
     availability/metrics are outside this Renderer's control, and the
     documented issue was never root-caused), DASH runs are painted as a
     simple, centered, continuous bar spanning the run's own already-
     canonical extent (unit-ink's box height, itself derived from
     GeometryTick like everything else) -- guaranteed visually continuous
     and centered by construction, never dependent on unverifiable font/
     browser behavior. The real "――" text stays in the DOM unchanged
     (source/semantic identity preserved) but its own ink is hidden
     (color:transparent) since the bar is the visible representation.
     ELLIPSIS/TWO_DOT_LEADER are explicitly untouched (P3-O05 remains its
     own, separate, still-OPEN item).

     P3-O04-DASH-STROKE-WEIGHT-HOLD: Human Visual QA rejected the original
     stroke thickness (12% of the unit's own cross-axis box width, itself
     the line's per-cell width) as far too heavy -- it read as a page rule/
     border, not publication-like prose punctuation. The stroke thickness
     formula is now expressed as an em value (bodyEmPaintSize times a
     relativeStrokeFactor) rather than a box-relative percentage: since
     .unit's own inline font-size is already set to the canonical
     fontSizePx, an em-unit width on this descendant resolves directly
     against that SAME already-tickToPx-scaled body metric -- proportional
     to Preview scale by construction, never a fixed disconnected px
     value, and now tied explicitly to the body font metric the task's own
     preferred formula names, not to box width (a related but indirect
     quantity in this specific 1-cell-wide case). relativeStrokeFactor is
     picked as the middle of a 3-candidate comparison (thin/medium-thin/
     lighter-than-original) generated for Human confirmation -- see
     qa/visual/p3-o04-dash-weight-comparison/ and
     qa/evidence/P3_O04_DASH_VISUAL.md's own HOLD section. */
  .unit.kind-SEMANTIC_RUN.semantic-dash .unit-ink { position: relative; color: transparent; }
  .unit.kind-SEMANTIC_RUN.semantic-dash .unit-ink::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 0.06em;
    background: #111;
  }
  .provisional-badge { display: none; }
  /* P3-O09-RUBY-ANNOTATION-ANCHOR-HOLD: text-align in a vertical writing
     mode (writing-mode:vertical-rl, inherited here from .unit) aligns
     content along the INLINE axis -- which for vertical-rl IS THE
     VERTICAL axis (text flows top-to-bottom within one "line"; lines
     themselves stack right-to-left, which is the block axis). Without
     this override, .ruby-annotation inherited .unit's own
     text-align:center (meant for ordinary, tightly-fitted body glyphs,
     where box height already equals content height so centering is
     invisible) -- but the annotation's OWN box height (extentPx, the
     reading's full logical extent, e.g. 5 cells for a 2-cell base with an
     OVERFLOW_OPEN policy) is deliberately larger than its actual rendered
     text (a smaller 0.55em font), so centering visibly pushed the text's
     apparent start DOWN from the box's own top:0 (aligned with the base
     run's own start) by roughly half the unused space -- landing near the
     body run's SECOND character instead of its first, exactly the Human
     Visual QA report. text-align:start anchors the annotation's text to
     the BEGINNING of the inline axis (the top, in vertical-rl) regardless
     of how much of the box's own height goes unused below it -- matching
     offsetPx's own contract (relative to the base run's own start). */
  .ruby-annotation { position: absolute; left: 100%; margin-left: 2px; font-size: 0.55em; white-space: nowrap; color: #444; text-align: start; }

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
  const debugText =
    `${unit.kind} [${unit.sourceSpan.start},${unit.sourceSpan.end}) y=${unit.debug.yTick} ${unit.heightIsApproximate ? "~h" : ""}` +
    (unit.semanticRunKind
      ? ` runKind=${unit.semanticRunKind} runBoxTop=${unit.topPx.toFixed(1)}px runBoxHeight=${unit.heightPx.toFixed(1)}px paintStrategy=${unit.semanticRunKind === "DASH" ? "painted-bar (font-independent)" : "native-glyph"}`
      : "");
  // P3-O09-RUBY-ANNOTATION-ANCHOR-HOLD: debug-only, human-readable trace of
  // the body run's own start/end alongside the annotation's, so a future
  // anchor discrepancy can be diagnosed from this tooltip alone.
  const rubyDebugText =
    unit.rubyAnnotation?.status === "PLACED"
      ? `body="${unit.text}" [${unit.sourceSpan.start},${unit.sourceSpan.end}) bodyTop=${unit.topPx.toFixed(1)}px bodyHeight=${unit.heightPx.toFixed(1)}px ` +
        `annotation="${unit.rubyAnnotation.text}" policy=${unit.rubyAnnotation.policy} annotationStart=${(unit.topPx + unit.rubyAnnotation.offsetPx).toFixed(1)}px ` +
        `annotationExtent=${unit.rubyAnnotation.extentPx.toFixed(1)}px offsetFromBody=${unit.rubyAnnotation.offsetPx.toFixed(1)}px`
      : undefined;
  // P3-O04-DASH-VISUAL: only DASH gets the painted-bar treatment;
  // ELLIPSIS/TWO_DOT_LEADER (P3-O05, still OPEN) are explicitly untouched.
  const unitClassName = `unit kind-${unit.kind}${unit.kind === "SEMANTIC_RUN" && unit.semanticRunKind === "DASH" ? " semantic-dash" : ""}`;
  return (
    <div className={unitClassName} style={{ top: unit.topPx, height: unit.heightPx, fontSize: fontSizePx }} title={mode === "debug" ? debugText : undefined}>
      {/* P3-O09-RUBY-ANNOTATION-MISSING-HOLD: the base glyph's own
          ink-clipping (overflow:hidden) lives on this inner wrapper, not
          on .unit itself, so a ruby annotation painted as .unit's own
          direct child (below, deliberately positioned OUTSIDE this
          wrapper's box) is never clipped by it — overflow only clips
          descendants, never siblings. */}
      <span className="unit-ink">
        {unit.kind === "IMAGE" ? (
          <span className="image-placeholder" />
        ) : unit.kind === "TCY" ? (
          // P3-O03-TCY-VISUAL: wraps ONLY the TCY unit's own text — the
          // canonical GeometryTick-derived position/extent (`.unit`'s own
          // top/height, set above from Core's already-composed placement)
          // is completely untouched; this wrapper only affects how the
          // text renders WITHIN that already-fixed box.
          <span className="tcy">{unit.text}</span>
        ) : (
          unit.text
        )}
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
