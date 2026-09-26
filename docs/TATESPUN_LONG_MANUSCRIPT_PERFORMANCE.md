# TateSpun Long Manuscript Performance (Phase 7)

Measured 2026-09-27 on branch `tsp-post-beta-typography-phase1`. The baseline is `60f9b66`
(Phase 6.1). Architecture context is in `TATESPUN_EDITOR_STATE_ARCHITECTURE.md` and
`TATESPUN_V2_CANONICALIZATION_AUDIT.md`.

## 1. Benchmark methodology

**Environment.** Intel Core i5-9400 (6 cores, 2.9 GHz), 32 GB RAM, Windows 11. Node v24.18.0.
Headless Chrome 153 (`tests/e2e/helpers`), viewport 1280×900, desktop split layout. The production
build (`npm run build`) is served from `out/` on loopback. Absolute numbers depend on machine
load, so compare only runs from the same session. The before and after builds were measured
side by side.

**Node pipeline benchmark.** `npx vitest run --config scripts/perf/vitest.config.ts longManuscript`
runs `scripts/perf/longManuscript.bench.ts`. It never asserts a time.
- Synthetic, deterministic manuscripts (`syntheticManuscript`) at the default settings
  (37 chars × 16 lines = 592 chars per page, about 80 % filled).
  - Text only: 10, 50, 100, 300 and 500 pages.
  - Featured at 100 pages: ruby, 傍点, ――/……, 【改ページ】, and 10 images; 50 images at 300 pages.
- Each stage runs 1 warm-up and then the median of 3 runs. The real Shippori Mincho measurement
  font is used.
- Stages measured:
  - LEGACY tokenize, paginate and source ranges
  - `buildV2UnitsFromManuscript`
  - `composeV2Layout`
  - Preview page model
  - Preview PaintDocument
  - `structuredClone` of the worker reply (a stand-in for postMessage cost)
  - page signatures
  - referenced-image scan
  - export `buildPublicationPaintPlan` with the font
- Results are written to `scripts/perf/results/<label>.json`.
- Env: `TATESPUN_PERF_LABEL`, `TATESPUN_PERF_RUNS`, `TATESPUN_PERF_ONLY=<fixtures>`,
  `TATESPUN_PERF_EXPORT_MAX_PAGES` (default 120).
- `scripts/perf/breakdown.bench.ts` gives the size of each field of the worker reply.
  `scripts/perf/exportProfile.bench.ts` is an inspector CPU profile of the export plan. Both are opt-in.

**Browser benchmark.**
`TATESPUN_E2E_BASE_URL=… TATESPUN_PERF_PAGES=300 node tests/e2e/longManuscriptPerf.e2e.mjs`.
- It seeds IndexedDB with one document (2 image markers) and 30 unrelated stored images.
- It wraps `Worker` to count constructions, compose requests and images per payload, and
  records long tasks.
- **Scenario A:** 3 isolated keystrokes on an idle page, each followed by its layout.
  Records keystroke → next frame, input → compose request, request → layout reply, and workers
  created.
- **Scenario B:** a burst of 8 keystrokes 60 ms apart. Records requests, workers, last input →
  final layout, and long tasks.
- It asserts correctness only: every keystroke is in the manuscript and every layout completes.
- `TATESPUN_PERF_PROFILE=1` prints a CPU profile of one keystroke.

## 2. Baseline measurements (`60f9b66`)

Node, milliseconds (median of 3):

| fixture | pages (LEGACY = V2) | LEGACY tok+pag+ranges | adapter | composeV2Layout | page model | paint doc | clone reply | export plan |
|---|---|---|---|---|---|---|---|---|
| text 10p | 12 | 1.0 | 1.0 | 43 | 1.1 | 3.7 | 55 | 1,242 |
| text 50p | 56 | 2.4 | 1.2 | 138 | 3.0 | 12 | 270 | 5,537 |
| text 100p | 112 | 3.9 | 2.4 | 303 | 5.9 | 23 | 685 | 11,390 |
| text 300p | 333 | 10 | 8.8 | 918 | 9.4 | 60 | 1,812 | (not run) |
| text 500p | 555 | 16 | 12 | 1,664 | 15 | 107 | 2,987 | (not run) |
| ruby 100p | 65 | 9.5 | **1,955** | **2,165** | 3.8 | 19 | 401 | 8,660 |
| 傍点 100p | 73 | 12.5 | 5.7 | 245 | 4.4 | 24 | 473 | 8,550 |
| ――/…… 100p | 88 | 3.1 | 2.8 | 308 | 3.2 | 30 | 563 | 8,418 |
| 改ページ 100p | 119 | 6.5 | 2.1 | 294 | 5.0 | 33 | 571 | 10,076 |
| images10 100p | 112 | 5.0 | 2.0 | 292 | 6.2 | 31 | 579 | 10,053 |
| images50 300p | 334 | 8.2 | 8.1 | 1,020 | 15 | 89 | 2,031 | (not run) |

- Export plan was measured once. At 300p and above it was not run: about 100 ms per page, and
  the first attempt ran out of the 4 GB Node heap.
- A 100 × 200 KB image pool takes 22.6 ms to `structuredClone`; 2 referenced images take 0.4 ms.
- `compositionInputsEqual` with a new but equal settings object costs 8.9 µs per call.
- The measurement provider is created in 23 ms (Node).

Browser, `60f9b66` (Scenario A median of 3; Scenario B once):

| | 100 pages | 300 pages |
|---|---|---|
| open → first V2 layout | 2,936 ms | 4,787 ms |
| images per compose payload | 32 (whole pool) | 32 |
| workers created per isolated edit | 1 | 1 |
| input → compose request | 572–932 ms | 700–1,228 ms |
| request → layout reply | 1,512–1,688 ms | 3,098–3,989 ms |
| keystroke → next frame | 123–174 ms | 263–362 ms |
| burst: requests / workers | 5 / 5 | 8 / 8 |
| burst: last input → final layout | 1,725 ms | 4,284 ms |

## 3. Bottlenecks confirmed

| # | Finding | Evidence |
|---|---|---|
| 1 | Manifest check on every keystroke (cloud projects with images) | The effect depended on live `content`. Every keystroke re-ran it, sent a request and restarted the 60 s interval. |
| 2 | New worker per composition, and the whole image pool copied into it and **decoded** in it (`prepareImageResolver` decodes every image) | 32 images per payload for a document that references 2. 1 worker per edit. |
| 3 | LEGACY tokenize, paginate and source ranges ran in stable V2 mode | Their results are unused once `v2PageModel` exists (classification in §4.3). |
| 4 | Three serial 180 ms debounces (Editor → Preview → adapter) | Measured input → request, see §5. |
| 5 | Local open loaded every stored image of every document | `loadAllImages()`. |
| 6 | `JSON.stringify(settings)` in comparisons | **Not confirmed:** 5–17 µs per comparison. |
| 7 | **New:** ruby reading spans were quadratic | `Array.from(source)` of the whole growing source per ruby: 1,955 ms adapter for ruby 100p. |
| 8 | **New:** export PaintPlan about 100 ms per page | CPU profile: 81 % in `FontBinary.view()`, which allocated a `DataView` per 16/32-bit font read. |
| 9 | **New:** one corrupt image data URL put the whole Preview on V2 HOLD | `atob` threw inside `parseDataUrl`, which rejected every image (the module's own contract says one CORRUPT image). |
| 10 | **New:** PreviewPane `React.memo` defeated on every keystroke | These props changed identity per render: `onDismissImageWarnings`, `onImageReplace` (`useCallback` deps on live `content`), and `onMobileExportClose` (a plain function). |
| 11 | Worker reply structured clone is larger than the composition | About 50 MB of JSON-equivalent per 100 pages (document 14 MB, model 16 MB, preview 19 MB). 3.0 s to clone at 500p. **Not changed**, see §7. |
| 12 | Keystroke frame (native) | 145–330 ms at 100–300p. A CPU profile of one keystroke is almost entirely native `(program)`, which points to layout of the 50k–142k-character controlled textarea. **Not changed.** |

## 4. Optimizations implemented

### 4.1 Manifest check keyed on the referenced image set
`referencedImageSignature(content)` (cloudImageSync) returns the sorted referenced ids.
- The poll effect depends on that key, `images`, `currentProjectId` and `cloudImagesRestoring`.
  It reads the live text only when it sends a request.
- Typing text leaves the key unchanged: **0 requests**, and the 60 s interval keeps running.
- Adding or removing a marker, changing the image pool, or opening another document or project
  still triggers a check.
- The Supabase query is unchanged.

### 4.2 Reusable V2 Preview worker and referenced-images payload
`ReusablePreviewWorker` (`src/lib/v2Bridge/previewWorkerClient.ts`), owned by `useV2PreviewAdapter`:
- An idle worker is reused (its font and measurement cache survive). A worker still composing a
  superseded request is terminated and replaced, which keeps the previous "new input cancels the
  old composition" behaviour.
- Requests carry monotonically increasing ids, and only the latest request that was not
  cancelled is delivered. So stale layouts and other documents' layouts can never land.
- A worker that errored or crashed is never reused. `dispose()` runs on unmount; a later request
  creates a new worker lazily, which keeps StrictMode safe.
- The payload holds only the images whose markers appear in the manuscript. `imageMarkerIds` uses
  the tokenizer's own `MARKER_PATTERN`, so the ids match the layout exactly.
- The `CompositionGate` still records the **full** input, so the Phase 3 export freshness
  contract is unchanged.
- The worker keeps a decode cache (`ImageResolutionCache`: id → data URL + resolution). Entries
  are evicted when their ids are no longer sent.

### 4.3 LEGACY pagination only while something reads it
Classification of the LEGACY tokenize, paginate and source ranges in V2 mode:

| Consumer | Class |
|---|---|
| `listPages` / `listSourceRanges` fallback before the first V2 layout | B |
| same, while V2 is on HOLD | A (fallback) |
| everything in LEGACY mode (`!useV2Engine`, rollback) | A |
| `imagePageIndicesById` when there is no `v2PageModel` | B |
| `getJpgScopeIndices` (LEGACY JPG path), `bodyPageCountForWarning` default (overwritten in V2) | A |
| TOC / inserted-part ranges (`computeInsertedPartPageRange` in TategakiEditor) | C: separate, not touched |
| PageCard overlays | D: already fed by `v2PageModel.overlayPages` |
| re-paginating on every text change once `v2PageModel` exists | **E: removed** |

`legacyPaginationNeeded = !useV2Engine || v2PageModel === null` gates both memos. They return
stable empty constants otherwise, and recompute immediately if V2 goes back to HOLD. Rollback is
unchanged.

### 4.4 Debounce pipeline

| Stage | Before | After | Purpose |
|---|---|---|---|
| Editor `previewContent` | 180 ms | 180 ms | Kept. It is the React.memo boundary for PreviewPane and the macrotask that keeps O(n) work off the keystroke task. |
| PreviewPane `deferredContent` | 180 ms | **removed** | It delayed the same work a second time. |
| adapter → worker | 180 ms | 180 ms (`V2_COMPOSITION_DEBOUNCE_MS`) | Kept. It is the single composition debounce, and it also covers live title typing and settings sliders. |

Typing → layout request went from 3 stages (≥540 ms) to 2 (≥360 ms). Composition frequency is not
increased: the adapter still debounces every input.

### 4.5 Document-scoped image loading
- `db.loadImagesByIds(ids)` does primary-key `bulkGet`. There is no schema change.
- A local open loads only `imageMarkerIds(content)`. The cloud open's local-original fallback also
  reads only referenced ids.
- The old all-images pool silently resolved a marker pasted from another document. A local-only
  top-up keeps that behaviour: missing referenced ids are fetched once per document, and the
  write is epoch-guarded.
- A TXT import marks its ids as attempted, so a TXT break stays a break, as before.
- Cloud projects keep their restore-only pool.

### 4.6 Settings fingerprint: not implemented
`compositionInputsEqual` already short-circuits on the same reference. With an equal new object,
the stringify comparison costs 9–17 µs, so a fingerprint system is not justified (§8 of the brief).

### 4.7 Render
The three PreviewPane props above now have stable identities: the image callbacks read
`liveContentRef` at call time, and `closeMobileExport` uses `useCallback`. No blanket memoization
was added.

### 4.8 Export
- `FontBinary` caches one `DataView` per buffer (typesetting-v2, publication).
- Ruby spans are linear (`manuscriptAdapter`).
- `parseDataUrl` maps bad base64 to CORRUPT for that one image.

## 5. Before / after

Node (medians; the after run was on a more loaded machine, so unchanged stages read 20–50 % higher):

| | before | after |
|---|---|---|
| ruby 100p: adapter / composeV2Layout | 1,955 / 2,165 ms | **4.9 / 195 ms** |
| export plan 10p / 100p | 1,242 / 11,390 ms | **458 / 765 ms** |
| export plan 300p / 500p | not feasible (≈100 ms per page, ran out of memory) | **1,940 / 3,000 ms** |
| export plan 20p (profile target) | 2,169 ms | **206 ms** |
| image payload clone, 100-image pool vs 2 referenced | 22.6 ms | 0.1 ms |

Browser (same session, side by side):

| | 100p before | 100p after | 300p before | 300p after |
|---|---|---|---|---|
| open → first layout | 2,936 ms | 2,069–2,125 ms | 4,787 ms | 4,412 ms |
| images per compose payload | 32 | **2** | 32 | **2** |
| workers per isolated edit | 1 | **0** | 1 | **0** |
| input → compose request | 572–932 ms | **368–400 ms** | 700–1,228 ms | **514–957 ms** |
| request → layout reply | 1,512–1,688 ms | **955–1,358 ms** | 3,098–3,989 ms | 2,838–3,653 ms |
| burst: requests / workers | 5 / 5 | 1–5 / 0–4 | 8 / 8 | 8 / 7 |
| burst: last input → final layout | 1,725 ms | 1,302–1,766 ms | 4,284 ms | 4,189 ms |
| keystroke → next frame | 123–174 ms | 110–146 ms | 263–362 ms | 265–325 ms |

- Burst results vary from run to run. At 100p a keystroke takes about 85–145 ms plus the 60 ms
  spacing, which sits right around the 180 ms debounce window. At 300p every keystroke is slower
  than the window, so every keystroke requests a layout in both builds.
- The export output is identical. The publication suite regenerated 41 QA PDFs, 6 JPGs and a ZIP:
  - All 6 JPGs are byte-identical, and so are the ZIP contents.
  - 40 of 41 PDFs are identical after normalizing their CreationDate and ID.
  - The 41st file (`structural-colophon-final-product-qa.pdf`) is written by two test files with
    different documents, and whichever finishes last wins. Regenerated from each writer alone,
    it is identical before and after.
- The E2E desktop PDF is 164,289 bytes, the same as Phase 6.1.

## 6. Correctness safeguards

- New tests:
  - `src/lib/v2Bridge/previewWorkerClient.test.ts`: reuse, supersede → terminate, stale and
    cancelled replies ignored, error or crash → never reused, dispose, referenced-only payload,
    decode cache, corrupt base64.
  - `src/lib/longManuscriptPerformance.test.ts`: manifest triggers (50 keystrokes → 1 check),
    `imageMarkerIds` equals the tokenizer's ids, targeted IndexedDB read (100 stored images, 2
    referenced → 2 read, no `toArray`), top-up.
  - `src/lib/v2Bridge/manuscriptAdapterPerformance.test.ts`: ruby spans equal the original
    definition, including astral characters.
  - `typesetting-v2/renderer/publication/fontBinaryViewCache.test.ts`: cached-view reads equal
    fresh `DataView` reads, including sub-views.
  - `src/components/longManuscriptPerformanceContract.test.ts`: wiring contract.
- Updated contracts: `editorDocumentSafety`, `editorDocumentScope`, `emptyPreviewRegression`.
  Their assertions moved to the new code locations; the asserted behaviour is the same.
- E2E: previewPageModel (boundary image, V2 count, reorder with ruby and 傍点), imageWarningLifecycle
  (TXT break, repair, 通知解除), autosaveFlush, mobileSharedExport and productionOddPageWarning
  all pass. The perf probe asserts that every keystroke landed and every layout completed.

## 7. Remaining bottlenecks

1. **The worker reply is about 50 MB per 100 pages.** It is serialized in the worker and
   deserialized on the main thread for every layout: 0.7 s cloned at 100p and 3.0 s at 500p, much
   of it main-thread long tasks.
   - `model` (the PublicationDocument, 16 MB per 100p) is only needed for export.
   - `document` and `preview` overlap.
2. **Keystroke frame of the full-manuscript textarea**, mostly native text layout: about 145 ms at
   100p and 300 ms at 300p. It exceeds the debounce windows, so at ≥300p every keystroke becomes a
   layout request.
3. **PreviewPane still re-renders all mounted spreads when a new layout lands.** `PreviewSpread`
   receives `children`, so its `memo` never skips, and each mounted spread runs its measure
   effect. In the dev-mode profile, `PreviewSpread` `updateHeight` took 465 ms per burst.
4. **Superseded compositions during slow typing** terminate and recreate the worker each time,
   paying the font parse again.
5. **The export plan still runs on the main thread** (3 s at 500p). The PDF worker then receives
   the whole plan plus the font in base64.
6. `pageSignatures` and the paint document are cheap (<0.2 ms and <170 ms at 500p) and are not
   worth changing now.

## 8. Recommended next performance work

1. Slim the layout reply. Do not send `model` with every Preview layout; build it for export only,
   in the worker, on request, for the exact gated input. Measure the size first, and keep the
   Phase 3 freshness contract.
2. Long-manuscript editor surface: evaluate the existing windowed/paged editor
   (`src/lib/windowedEditor`, `editorPagination`) as the default above a size threshold, so the
   native textarea no longer lays out the whole manuscript on each keystroke.
3. Render the spread children inside `PreviewSpread` from stable props (page indices, memoized
   slot data) so `memo` can skip unchanged spreads.
4. When a request arrives while the worker is busy, consider "let it finish, then run only the
   latest" instead of terminate + recreate, once reply slimming makes compositions short. Decide
   from measurements.
5. Move `buildPublicationPaintPlan` into the PDF/JPG worker.
