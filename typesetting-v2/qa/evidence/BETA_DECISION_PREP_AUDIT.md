# TateSpun β decision-preparation audit

Date: 2026-09-10

Baseline: `12d8c31`

Scope: mobile Demo viewport fit, Production PDF feasibility, bleed/TXT/rollout decisions, and the next Production Integration order. No deploy, push, master merge, or full integration is authorized here.

## Closed Human state

The latest Human result closes the 13-item final content/UX packet. The primary Demo work-session step, detailed checklist guidance, responsive target placement, Help TOC/navigation/narrow behavior, TOC-dialog alignment, and export Esc pause/resume/cancel behavior are Human PASS. 11-B is CLOSED / FORMAL HUMAN PASS; Ruby and Typography remain closed.

The only newly implemented visual behavior awaiting Human QA is the narrow Demo one-viewport shell described below.

## Mobile Demo viewport fit

The real `src/` Editor now marks only `demo=1` with `data-demo-mode`. Below `md`, that shell uses `100dvh`, hides the duplicate full Header, prevents page-level scrolling, and gives the active manuscript/Preview/Settings surface the remaining height with internal overflow where needed. The normal non-Demo mobile Editor retains its existing document-scroll model; `md+` keeps the prior desktop shell.

The existing Demo controller already calls `scrollIntoView({ block: "center" })` after changing to the target workspace, then recalculates a fixed card against the current document viewport. The card body is internally scrollable and its navigation/exit rows are fixed within the card. Focused static and geometry tests cover the conditional shell, dynamic viewport, internal manuscript flex, selector isolation, card containment, and target scrolling contract.

Status: **IMPLEMENTED / HUMAN QA PENDING**.

## Browser / Production PDF architecture

### Actual path today

Production `src/components/PreviewPane.tsx` still calls the legacy DOM-capture PDF path in `src/utils/exportPdf.ts`. The passed v2 vector path is exercised by the standalone development Editor:

`App.tsx` → POST `/api/export` → Vite development middleware → `composeV2Document` → `generatePublicationPdf` → jsPDF bytes.

That Vite middleware reads the committed TTF with `node:fs` and uses Node `Buffer` for HTTP chunks/response bytes. It is development tooling, not a deployable Production endpoint.

The v2 composition and `PaintPlan` are already plain TypeScript and browser-importable. The PDF executor uses jsPDF and returns `Uint8Array`, but its real-font path still crosses Node-only `Buffer` boundaries:

- `pdfGenerator.ts`: base64 font decode (four `Buffer.from` call sites) and image wrapping (`Buffer.from`).
- `fontCapability.ts`, `fontMetrics.ts`, `gsubReader.ts`, `gposReader.ts`: `Buffer` types and `readUInt*BE`/`readInt*BE`/latin-1 table-tag reads.
- `verticalOutlinePaint.ts`, `verticalGposPaint.ts`, `verticalYakumonoAlign.ts`: accept/pass `Buffer`; `opentype.js` itself can be fed browser binary data after an adapter.
- Real font asset currently lives in QA evidence, not a Production public/bundled font resource.

Safe feasibility spike: esbuild produced a browser ESM bundle. With `globalThis.Buffer = undefined`, a fontless one-page `renderPaintPlanToPdf` generated 3,088 bytes, while `deriveBaselineRatioFromFont` failed exactly at `Buffer.from`. This isolates the blocker to binary adapters/resource loading; it does not reopen PaintPlan or typography.

### Option A — client-side browser executor (recommended)

- Processing/privacy: manuscript, settings, font, images, PaintPlan, and PDF remain on the user's device; no manuscript upload.
- Reuse: highest. Reuse `composeV2Document`, the passed PaintPlan, jsPDF executor, and real-image commands.
- Required work: replace the reader boundary with `Uint8Array` + `DataView` (or one narrowly scoped browser-safe byte reader), pass `Uint8Array` directly to jsPDF image APIs, publish/bundle the licensed font and load it locally, and add an async client export coordinator.
- 100+ pages: CPU and peak memory stay on the device. Prefer a dedicated browser Web Worker and transferable binary inputs so composition/PDF work does not freeze the Editor. The full PaintPlan and final PDF still exist in memory; page-level yielding/progress must be measured.
- Cancellation: a Worker can honor cooperative page boundaries and can be terminated before the final Blob handoff. A download already handed to the browser remains unrecoverable.
- Images/fonts: local `Uint8Array`/Blob data and one bundled font; no server upload. Missing/corrupt images keep the existing HOLD behavior.
- Deployment: fits the current static `output: "export"` build and Pages hosting. No new backend.
- Failure modes: low-memory mobile termination, unsupported/corrupt font/image, long synchronous jsPDF steps, or Blob/download failure. Surface an error and leave legacy export selectable under the rollout flag.
- Scope/risk: medium. Binary-reader conversion is mechanical but typography regression tests and real 100-page browser measurements are required.
- Rollback: switch the rollout flag to legacy without deleting either engine.

### Option B — Next.js Node Route Handler

- Processing/privacy: manuscript and required images leave the browser and are processed by TateSpun's server. This is a material change to the local-first promise and needs explicit disclosure/security limits.
- Reuse: current Node renderer can be reused almost unchanged; request/response and font loading resemble the Vite tool.
- 100+ pages: moves CPU/memory off the device but risks request size, server memory, timeout, concurrency, and platform response limits.
- Cancellation: aborting `fetch` does not guarantee server work stops; the route must propagate `request.signal` into page boundaries. A server may continue after disconnect.
- Images/fonts: multipart/binary upload or large JSON/base64 request; font can live server-side.
- Deployment: **not supported by the current configuration**. `next.config.ts` uses `output: "export"`; static export cannot host a dynamic Route Handler. This option requires changing the deployment architecture and privacy boundary.
- Failure/rollback: route timeout, payload rejection, cold start, capacity or network failure; legacy browser export can remain fallback.
- Scope/risk: high for this repository, despite low renderer-port effort.

### Option C — edge Worker/serverless PDF service

No Worker deployment/configuration or PDF service exists in this repository. The current Next version documents Edge runtime as deprecated, and the same Node `Buffer` reader boundary would still need conversion. It also inherits Option B's manuscript-upload/privacy, payload, timeout, cancellation, and operations costs. **Not a genuine current-stack β option.**

### Option D — keep the Vite local API

This works only for development and reads files from the developer checkout. It cannot back the statically exported Production site. **Not a release architecture.**

Engineering recommendation: **Option A, executed in a client-side Web Worker where supported, behind a reversible rollout flag.** It matches the static deployment and local-first promise, reuses the passed PaintPlan, and turns the known blocker into a bounded binary-adapter task.

## Bleed / trim audit

Plain-language definitions:

- **Trim size** is the final cut page (for example A5 is 148 × 210 mm).
- **Bleed** is artwork extending beyond that cut line so cutting does not expose a white edge (the legacy Editor uses fixed 3 mm per side).
- **Margin** is the safe space inside the trim edge for body text; it is not bleed.
- **Full-bleed image** must cover the trim plus bleed sheet and tolerate edge cropping.

What exists today:

- Legacy Preview creates a sheet at trim + 3 mm on every edge, offsets text margins inside the trim line, and lets a `full` image cover that whole bleed-included sheet with `object-fit: cover`.
- Legacy PDF can emit trim size (central crop), fixed-3-mm bleed size, or a larger crop-mark sheet; print JPG crops to trim. This is a rasterized DOM path.
- v2 `PublicationPageGeometry` contains paper/trim size and margins only. PaintPlan page size equals trim size. Its vector PDF and browser/Node JPG have no separate bleed box; print JPG's historical “crop” is therefore an explicit no-op. A `full` image in v2 can fill only the trim page.

### Option A — trim-only v2 β (recommended)

- Visible behavior: v2 PDF/JPG output is final trim size only. Export UI and Help must not claim 3-mm bleed or crop marks.
- Supports: text-centric novels and images intentionally kept inside the trim/safe area.
- Does not support: print-ready edge-to-edge artwork. Full-page images reach the cut edge but have no sacrificial bleed; users must use another tool/workflow for full bleed.
- Scope: copy/mode cleanup, guardrails, and tests; Canonical stays unchanged.
- Risk/schedule: lowest. Preserve legacy fallback during β for existing workflows, but label which engine/mode produced the file.

### Option B — fixed 3-mm v2 bleed

- Visible behavior: trim, 3-mm bleed, and optionally crop-mark output match the current legacy concepts; full-page artwork covers trim + 3 mm.
- Supports: common fixed-3-mm print workflows and edge-to-edge art.
- Scope: add publication output-box geometry, translate body/furniture into the trim box, extend full images, implement PDF mode boxes/crop marks and JPG trim crop, then verify odd/even margins, folio/header/colophon/images in all modes.
- Canonical: text layout can remain trim-based; the Publication/PaintPlan layer needs an explicit trim box inside a larger output box.
- Risk/schedule: medium-high; substantially larger geometry/output matrix and real-printer QA.

### Option C — configurable/full bleed architecture

- Visible behavior: configurable bleed and richer full-page artwork controls.
- Supports: the widest illustrated/color use cases.
- Scope: settings/persistence/UI/migrations, Canonical-to-Publication contract extension, PDF/JPG modes, validation, documentation, and broad preset/printer tests.
- Risk/schedule: highest and not justified for the text-centric β.

Recommendation: **Option A for β**, with an explicit limitation and legacy fallback retained. Schedule Option B as the first post-β print-output expansion if Human demand requires edge-to-edge art.

## TXT contract and safe foundation

### Existing source semantics

- The Editor's `content` string is the portable manuscript authority. Ordinary text and paragraph/newline structure live there directly.
- Manual break: literal `【改ページ】` under the existing line/end-of-line rules.
- Ruby: `｜親文字《よみ》` (the parser also accepts established implicit kanji ruby).
- TCY: ordinary source remains ordinary; current automatic two-digit/punctuation-pair detection is derived on parse. Explicit source uses `[tate]…[/tate]`.
- Image: visible source token `【IMG:<id>:<widthMm>:<heightMm>:<position>】`; binary image data is separate and cannot live in a normal TXT.
- Structural horizontal colophon and page settings are separate document settings, not manuscript source. Generated title/TOC/body text already inserted into `content` remains ordinary source. A plain TXT must not invent hidden metadata for the separate settings.

### Option A — portable TateSpun source (recommended)

Export UTF-8 **without BOM**, normalize output to LF, and import UTF-8 with or without BOM while accepting CRLF/LF and normalizing internally to LF. Preserve all manuscript characters and existing visible TateSpun tokens exactly apart from line-ending normalization. Keep image tokens but clearly warn that TXT does not contain the binary images; unresolved imports require reattachment and must never export silently as valid images. Do not serialize separate colophon/page settings into TXT.

Advantages: local, transparent, diff/version-control friendly, round-trips TateSpun structure, works in normal editors. Disadvantages: TateSpun markers are visible and images are references rather than embedded files. Scope/risk: low-medium.

### Option B — Windows-compatibility variant

Same visible source/token policy, but export UTF-8 with BOM and CRLF. Advantages: most explicit legacy Windows-editor detection. Disadvantages: adds BOM/CRLF churn and is less convenient for web/version-control workflows. Scope is similar to A.

### Option C — clean prose TXT

Strip structural/image tokens and export only reading text. It is pleasant to read elsewhere but lossy: manual breaks, explicit TCY, and image placement cannot round-trip. This conflicts with the user-owned portable-source goal and belongs, if ever, in post-β export profiles rather than the baseline contract.

Safe implementation completed now: a typed, strict UTF-8 encode/decode boundary; explicit (no-default) BOM/newline profile; BOM input handling; local File API reader with Japanese errors; local Blob/object-URL download; shared safe title-derived `.txt` filename; opaque preservation tests for every existing token; and a structural no-network assertion. No UI was wired and no Product default was frozen.

Recommendation: **Option A**.

## Export rollout / rollback

Actual state: Production builds hard-pin `PreviewPane` and exports to the legacy engine. The current/new Preview switch is development-only state and is not persisted. v2 Canonical/PaintPlan bridge exists in `src/`; v2 vector PDF is reached only through the local Vite API; v2 browser JPG is wired only in the standalone development Editor. Legacy remains intact.

### Option A — direct replacement

Lowest user complexity and least dual-path code, but slow rollback, maximum β blast radius, and no safe comparison window. QA is simpler only after stability is already proven. Not recommended.

### Option B — internal feature-flagged staged rollout (recommended)

Keep one normal user experience; select v2 or legacy through a build/runtime rollout flag unavailable as an everyday manuscript setting. Start internal/QA, then limited β, then v2 default. Rollback is a flag change. Complexity and temporary drift/QA burden are moderate; explicit shared contracts and an expiry/removal criterion are required.

### Option C — v2 default with a visible legacy fallback

Fast per-user escape hatch and useful failure evidence, but exposes engine terminology/choice to non-technical users, doubles support paths, and encourages long-lived drift. Reserve as an emergency diagnostic control, not the normal β UI.

Recommendation: **Option B**. Do not delete legacy until v2 passes the real-manuscript matrix, 100-page PDF measurement, cancellation, images, and rollback rehearsal.

## Actual branch integration map

### ALREADY BRANCH-INTEGRATED

- Memo data/persistence (`plotNote`) exists in the real document model, though direct UI-C access still needs integration.
- Visible Undo/Redo and native history path.
- Manual page-break insertion and legacy/v2 source propagation.
- 11-B work sessions and history.
- Writing Check functional and visual-polish code (preserve; final Production E2E still required).
- Help top TOC/navigation and TOC-dialog alignment (Human PASS).
- Export Esc cooperative pause/cancel on current Production export paths (Human PASS; rewire to final v2 paths later).
- Demo content/placement; narrow viewport-fit added this run (Human QA pending only for the new fit).
- `composeV2Document`, settings/manuscript/image adapters, and development-only New Preview entry.
- v2 browser JPG executor and passed Publication renderer exist as reusable engines.

### NEEDS INTEGRATION / READY

- UI-C drawer shell, direct Memo access, and 完成前マイチェックリスト from the development Editor.
- Canonical Preview as an approved Production path behind rollout control.
- v2 JPG actions/ZIP and real image resolution/HOLD wiring from real Production state.
- Frozen Top/Hero/subcopy/journey/privacy copy; current top still says `あなたの本棚` and does not implement the frozen Hero.
- TXT UI wiring after the contract decision; utility boundary is ready.
- Final cancellation coordinator wiring around v2 PDF/JPG/ZIP.

### BLOCKED

- Browser vector PDF: blocked by the PDF architecture decision, then by the bounded byte-reader/font-resource work.
- v2 export geometry/mode UI: blocked by the bleed decision.
- TXT defaults and source-warning UI: blocked by the TXT contract decision.
- Which engine ships to which users: blocked by rollout decision.

## Shortest dependency-safe Production Integration order

1. Record the four Human decisions; add the chosen internal rollout flag while preserving legacy.
2. Integrate UI-C drawer + direct Memo + checklist, reusing already-integrated Undo/Redo, manual break, sessions, Help, TOC polish, and Writing Check.
3. Wire Canonical Preview from real state behind the flag.
4. Wire real image resolution/HOLD into the shared v2 PaintPlan.
5. Implement the approved browser PDF binary/font executor and chosen output-box/bleed policy; measure a realistic 100+ page file.
6. Wire v2 Web/print JPG/ZIP to the same PaintPlan and geometry policy.
7. Connect the existing cancellation coordinator/progress contract to all final v2 export boundaries.
8. Wire TXT local import/export UI using the approved profile and explicit image/settings disclosure.
9. Apply the frozen Top/Hero/subcopy/journey/privacy copy without redesign.
10. Run real-manuscript E2E, responsive/accessibility/privacy/output isolation, rollback rehearsal, build, then the explicit RC Human gate.

This order does not remove legacy, reopen Typography/Ruby/11-B, or authorize release operations.
