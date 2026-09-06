// Stage D — React absolute-position painter (PREVIEW_DEVELOPMENT_ADAPTER_PLAN.md
// §6/§15, Option A). PAINTS already-decided ViewModel coordinates only —
// no browser text flow, no CSS writing-mode as layout authority, no
// flex/grid auto-placement for canonical units (every positioned element
// below uses `position:absolute` + explicit px from the ViewModel, which
// itself only ever reads GeometryTick values — never anything measured by
// the browser). NORMAL/DEBUG view toggle is pure CSS (a checkbox + sibling
// selector) — no client-side JavaScript at all, so the artifact is a fully
// static file a Human can open directly, no server required.

import type { PreviewViewModel, ViewPlacedUnit } from "./viewModel";

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; background: #f4f2ee; color: #222; margin: 0; padding: 24px; }
  h1 { font-size: 18px; }
  .nav { margin-bottom: 16px; }
  .nav a { margin-right: 12px; font-size: 13px; }
  .toggle-row { margin-bottom: 16px; font-size: 13px; }
  .fixture { border-top: 4px solid #333; padding-top: 12px; margin-bottom: 40px; }
  .fixture h2 { font-size: 15px; margin: 0 0 4px; }
  .fixture .meta { font-size: 12px; color: #666; margin-bottom: 12px; }
  .hold-banner { background: #c0392b; color: #fff; padding: 8px 12px; font-size: 13px; margin-bottom: 12px; border-radius: 4px; }
  .font-warning { background: #e67e22; color: #fff; padding: 6px 10px; font-size: 12px; margin-bottom: 12px; border-radius: 4px; display: inline-block; }
  .page-row { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
  .page { position: relative; background: #fff; border: 1px solid #999; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
  .page-label { position: absolute; top: -18px; left: 0; font-size: 11px; color: #555; }
  .page-break-marker { position: absolute; top: -3px; left: 0; right: 0; border-top: 2px dashed #c0392b; }
  .column { position: absolute; top: 0; }
  .line { position: absolute; top: 0; border-left: 1px dotted #ddd; }
  .unit { position: absolute; left: 0; right: 0; overflow: hidden; writing-mode: vertical-rl; font-size: 12px; line-height: 1; white-space: nowrap; }
  .unit.kind-TEXT { color: #111; }
  .unit.kind-RUBY { color: #8e44ad; background: rgba(142,68,173,0.08); }
  .unit.kind-TCY { color: #2980b9; background: rgba(41,128,185,0.08); }
  .unit.kind-SEMANTIC_RUN { color: #16a085; background: rgba(22,160,133,0.08); }
  .unit.kind-IMAGE { background: repeating-linear-gradient(45deg, #ccc, #ccc 4px, #ddd 4px, #ddd 8px); }
  .indent-marker { position: absolute; left: 0; right: 0; top: 0; background: repeating-linear-gradient(-45deg, #eee, #eee 3px, #f7f7f7 3px, #f7f7f7 6px); border-bottom: 1px dashed #bbb; }
  .residual-marker { position: absolute; left: 0; right: 0; bottom: 0; background: rgba(0,150,0,0.06); border-top: 1px dashed #9c9; }
  .provisional-badge { position: absolute; bottom: -1px; right: -1px; font-size: 8px; background: #f39c12; color: #fff; padding: 0 2px; line-height: 1.2; }
  .debug-info { display: none; position: absolute; left: 100%; top: 0; white-space: nowrap; font-size: 9px; background: #222; color: #0f0; padding: 1px 3px; z-index: 5; pointer-events: none; }
  #debug-toggle:checked ~ .app .debug-info { display: block; }
  #debug-toggle:checked ~ .app .unit { outline: 1px solid rgba(0,0,0,0.15); }
`;

function DebugBadge({ text }: { text: string }) {
  return <span className="debug-info">{text}</span>;
}

function UnitBox({ unit }: { unit: ViewPlacedUnit }) {
  const debugText = `${unit.kind} [${unit.sourceSpan.start},${unit.sourceSpan.end}) ${unit.heightIsApproximate ? "~h" : ""}`;
  return (
    <div
      className={`unit kind-${unit.kind}`}
      style={{ top: unit.topPx, height: unit.heightPx }}
      title={debugText}
    >
      {unit.text}
      {unit.provisional && <span className="provisional-badge">prov</span>}
      <DebugBadge text={debugText} />
    </div>
  );
}

function PageView({ page }: { page: PreviewViewModel["pages"][number] }) {
  return (
    <div className="page" style={{ width: page.widthPx, height: page.heightPx }}>
      <span className="page-label">
        page {page.order}
        {page.manualBreakBefore ? " — manual break before" : ""}
      </span>
      {page.manualBreakBefore && <div className="page-break-marker" />}
      {page.columns.map((column) => (
        <div key={column.id} className="column" style={{ right: column.rightPx, width: column.widthPx, height: page.heightPx }}>
          <DebugBadge text={`col ${column.order}, residual ${column.residualSpacePx.toFixed(1)}px`} />
          {column.lines.map((line) => (
            <div key={line.id} className="line" style={{ right: line.rightPx, width: line.units.length ? undefined : 4, height: page.heightPx }}>
              <DebugBadge text={`line ${line.order}${line.indentPx !== undefined ? `, indent ${line.indentPx.toFixed(1)}px` : ""}`} />
              {line.indentPx !== undefined && <div className="indent-marker" style={{ height: line.indentPx }} />}
              {line.units.map((unit) => (
                <UnitBox key={unit.id} unit={unit} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function FixtureSection({ model }: { model: PreviewViewModel }) {
  return (
    <section className="fixture" id={model.id}>
      <h2>{model.label}</h2>
      <div className="meta">
        {model.renderedPageCount} of {model.totalPageCount} page(s) rendered
        {model.renderedPageCount < model.totalPageCount ? " (bounded page window)" : ""}
      </div>
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
            <PageView key={page.id} page={page} />
          ))}
        </div>
      )}
    </section>
  );
}

export function PreviewApp({ viewModels }: { viewModels: PreviewViewModel[] }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <title>TateSpun v2 — Stage D Preview Development Adapter</title>
        <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      </head>
      <body>
        <input type="checkbox" id="debug-toggle" style={{ display: "none" }} />
        <div className="app">
          <h1>TateSpun v2 — Stage D Preview Development Adapter (DEV ONLY, NOT PRODUCTION)</h1>
          <p style={{ fontSize: 12, color: "#666", maxWidth: 640 }}>
            Paints already-decided CanonicalDocument coordinates only — this tool never re-tokenizes, re-runs
            kinsoku, chooses breaks, or derives capacity. Purple/blue/teal/hatched boxes (RUBY/TCY/SEMANTIC_RUN/
            IMAGE) are labeled <strong>prov</strong> (provisional) — their body placement is Core-decided and
            final, but their own visual treatment is not yet solved (P3-O03/O04/O05/O06, ruby-placement wiring).
          </p>
          <div className="toggle-row">
            <label htmlFor="debug-toggle" style={{ cursor: "pointer", textDecoration: "underline" }}>
              Click here to toggle DEBUG VIEW (page/column/line index, source span, unit kind) — pure CSS, no
              JavaScript on this page.
            </label>
          </div>
          <div className="nav">
            {viewModels.map((m) => (
              <a key={m.id} href={`#${m.id}`}>
                {m.label}
              </a>
            ))}
          </div>
          {viewModels.map((m) => (
            <FixtureSection key={m.id} model={m} />
          ))}
        </div>
      </body>
    </html>
  );
}
