# TateSpun V2 Renderer Migration Specification

- Status: **PLANNED / NOT YET DEFAULT**
- Scope: TateSpun renderer migration (LEGACY → V2)
- Purpose: Preserve the decision that TateSpun should eventually move from the current LEGACY renderer to V2, while preventing an unsafe default switch before parity is proven.
- Last updated: 2026-09-13

## 1. Decision

- TateSpun will eventually make the V2 renderer the standard/default renderer.
- The current LEGACY Preview virtualization work (TSP-LEGACY-PREVIEW-VIRTUALIZATION-001) is a β safety/performance measure. It is **not** a cancellation of the V2 migration plan, and completing it does **not** by itself close this item — see §6.
- Production default stays LEGACY until every item in the §6 release gate is PASS.

The current beta strategy is:

1. Keep LEGACY as the production-default renderer.
2. Improve LEGACY interactive Preview performance with virtualization/windowing only (done — see TSP-LEGACY-PREVIEW-VIRTUALIZATION-001).
3. Preserve LEGACY pagination, typography, page features, TOC behavior, and export behavior during that fix.
4. Close V2 parity gaps separately (§6, unstarted as of this writing).
5. After parity is proven, switch the production default from LEGACY to V2 through an explicit release decision.

## 2. Why V2 remains the long-term target

V2 already has major architectural advantages for long documents:

- LEGACY Preview mounts every page's DOM at once; V2 already windows/virtualizes.
- A real long manuscript (231k–296k chars, 562–720 pages) was measured producing ~243k–313k DOM elements and 20–34s main-thread long tasks under LEGACY, with a ~3.7GB Chrome memory warning — purely from full-tree mount.
- The same class of workload produced ~19k DOM elements under V2 in prior A/B comparison testing (TSP-BETA-RENDERER-AND-END-LATENCY-AUDIT-001) — roughly 12x lighter.
- V2 Preview virtualization and zoom-anchor behavior have already passed Human QA.
- V2 uses the canonical FixedSlot-based renderer and is the intended newer architecture (`typesetting-v2/core/`).

V2 is the intended long-term renderer once functional parity and publication safety are proven.

## 3. Why V2 is NOT the default yet

The V2 default rollout is currently **HOLD** (TSP-V2-BETA-DEFAULT-PARITY-GATE-001). Known blockers:

1. **Per-page nombre override has no V2 equivalent.** LEGACY supports `settings.pageOverrides[n].hideNombre`; V2's `settingsAdapter.ts` explicitly documents dropping it ("silently dropped here, not silently claimed as supported").
2. **LEGACY-vs-V2 pagination/page-count parity is unproven.** No automated test compares `paginateTokens` (LEGACY) against `composeCanonicalDocument` (V2) output for the same manuscript + settings across representative content.
3. **TOC page numbers are computed via LEGACY's pagination engine and baked into the manuscript as literal text** (`src/utils/tocGenerator.ts` calls `computePageSourceRanges`/`findPageIndexForCharIndex` from LEGACY's own module). Without item 2 being proven, a manuscript with a generated table of contents risks wrong page numbers under V2.
4. **PDF/JPG export changes from raster to vector as a direct, structural consequence of the renderer flag** (`PreviewPane.tsx`'s `useV2Engine` branch in `performDownloadPdf`/JPG export functions). LEGACY exports via DOM/html2canvas-style screenshot; V2 exports via a genuine vector `PaintPlan` pipeline (`startV2PdfWorker`). Likely better quality, but not "unchanged" — requires its own explicit Human QA and product sign-off, not an incidental side effect of a performance fix.
5. **Remaining feature/publication parity sign-off is incomplete** — colophon, master-page settings, hashira per-page overrides, and the full typography/layout surface have not been independently re-verified V2-vs-LEGACY end to end (existing V2-internal and V2-vs-InDesign tests are necessary but not sufficient for this).

### 3.1 Detail: full page-feature parity surface

Before default rollout, explicitly verify — for both renderers, same manuscript, same settings:

- Ruby (short/long)
- DASH / ellipsis
- half-width Latin / numbers
- TCY
- kinsoku / hanging behavior
- explicit page breaks
- images: top / center / bottom / full-page, and page-breaking around images
- 1-column / 2-column
- paper sizes
- margins / column gap
- font size / line height
- nombre, per-page nombre override
- hashira, per-page hashira override
- master-page settings
- colophon placement
- first-page behavior
- page ordering
- empty document, document switching
- cloud-loaded settings reproduce correctly
- JPG / PDF / ZIP / TXT surfaces where applicable

## 4. Beta-era LEGACY performance work

During beta, LEGACY may receive Preview-only performance improvements such as virtualization/windowing (already done — TSP-LEGACY-PREVIEW-VIRTUALIZATION-001). These improvements MUST preserve:

- LEGACY tokenizer
- LEGACY pagination and page count
- LEGACY typography
- LEGACY TOC behavior
- LEGACY nombre/hashira/colophon behavior
- LEGACY JPG/PDF semantics (raster, unchanged)

Interactive Preview virtualization may change which page DOM nodes are mounted at one time, but must not change the underlying page model. Where export requires all pages to be mounted (LEGACY's raster capture does), use a dedicated, temporary export-mount path rather than disabling interactive virtualization permanently — this is exactly what TSP-LEGACY-PREVIEW-VIRTUALIZATION-001 implemented (`ensureExportMount`/`releaseExportMount` in `PreviewPane.tsx`).

## 5. V2 migration phases

### Phase A — Beta stability

Goal: make the current LEGACY-default product safe and usable for long manuscripts.

- Complete LEGACY Preview virtualization. **DONE** (TSP-LEGACY-PREVIEW-VIRTUALIZATION-001, checkpoint `86d5a45`).
- Verify long-manuscript input responsiveness. **DONE** for the input-latency chain (TSP-EDITOR-INPUT-PERFORMANCE-001 through TSP-EDITOR-END-OF-DOCUMENT-LATENCY-003).
- Verify scroll/zoom/cursor-follow under virtualization. Partially verified (mount/unmount and cursor-jump verified by automation; zoom cycling not explicitly scripted — Human QA still required).
- Preserve existing exports. **DONE** (export-mount override verified with real JPG/PDF output).
- Remove or retire temporary perf-debug instrumentation (`src/lib/perfDebug.ts`, `src/components/PerfDebugPanel.tsx`) after the forensic investigation that motivated it is fully closed.

Exit: long-document beta blocker closed. (Believed closed pending final Human QA sign-off.)

### Phase B — Close V2 parity gaps

Goal: bring V2 to feature and publication parity. **Not started.**

- Add per-page `hideNombre` parity to V2 (§3 item 1).
- Establish a canonical TOC/pagination strategy and build LEGACY-vs-V2 pagination comparison fixtures (§3 items 2–3).
- Verify colophon/master-page/hashira-override parity (§3 item 5).
- Close any remaining page-feature differences found in §3.1.

Exit: no known functional feature silently disappears under V2.

### Phase C — Publication sign-off

Goal: approve V2 PDF/JPG as an intentional production output. **Not started.**

- Compare raster LEGACY output and vector V2 output directly.
- Verify dimensions, page counts, fonts, typography, images.
- Real-manuscript Human QA of the vector output specifically.
- Document the raster→vector change as an intentional product change, not an incidental one.

Exit: Publication PASS.

### Phase D — V2 default rollout

Goal: make V2 the standard production renderer. **Not started; requires all of §6.**

- All §6 release-gate items PASS.
- Automated regression suite PASS.
- Human QA PASS.
- Rollback path documented (see §7).
- Production environment explicitly configured — no silent dependency on an unset `NEXT_PUBLIC_TATESPUN_RENDERER`.

Preferred result: V2 becomes the explicit canonical default; LEGACY remains available temporarily as rollback/fallback only.

### Phase E — LEGACY retirement

Only after V2 has been stable in production:

- Determine whether LEGACY can be removed, via a separate audit.
- Remove dead compatibility paths only after that audit.
- Update docs/tests/export assumptions accordingly.

Do not delete LEGACY during the initial V2 default rollout.

## 6. V2 default release gate

V2 may become the production default only when every item below is PASS:

- [ ] per-page `hideNombre` supported in V2
- [ ] TOC page-number strategy is canonical and tested
- [ ] page-count/pagination parity (LEGACY vs V2) proven, or intentional differences explicitly documented
- [ ] Ruby PASS
- [ ] DASH / ellipsis PASS
- [ ] Latin PASS
- [ ] TCY PASS
- [ ] kinsoku PASS
- [ ] images PASS
- [ ] 1-column / 2-column PASS
- [ ] paper-size / layout settings PASS
- [ ] nombre / hashira PASS
- [ ] per-page overrides PASS
- [ ] colophon / master-page PASS
- [ ] real manuscript, 100+ pages, PASS
- [ ] real manuscript, 500+ pages, PASS
- [ ] JPG PASS
- [ ] PDF PASS
- [ ] vector publication output explicitly approved (not an incidental side effect)
- [ ] save/load/cloud compatibility PASS
- [ ] Preview virtualization PASS
- [ ] zoom anchor PASS
- [ ] cursor-follow PASS
- [ ] TypeScript / ESLint / production build PASS
- [ ] rollback procedure documented
- [ ] Human QA PASS

**Rule: if any item above is UNKNOWN (not explicitly checked, not just "probably fine"), V2 default rollout stays HOLD.** Completing LEGACY Preview virtualization does not check off any item in this list on its own.

## 7. Configuration / rollout rule

Current renderer selection uses `NEXT_PUBLIC_TATESPUN_RENDERER` (`src/lib/v2Rollout.ts`), a single build-time flag with no per-user/session override. It fails closed to LEGACY when unset or invalid.

Before V2 default rollout:

- Choose one canonical source of truth for the flag (still `NEXT_PUBLIC_TATESPUN_RENDERER`, or a deliberate replacement).
- Make the intended production default explicit in the build/deploy configuration — not implicit via an unset variable.
- Document valid values and the rollback procedure (flip the flag back to LEGACY, rebuild, redeploy).
- Verify the actual production build environment (e.g. Cloudflare Pages config) sets the flag as intended — this document only audits the repository's own code, not the live deploy pipeline's secrets.
- Avoid per-user hidden renderer divergence unless intentionally designed later.

## 8. Relationship to current roadmap

This specification is a permanent architecture/migration document. The main roadmap (`typesetting-v2/docs/roadmap/TateSpun_BETA_UNIFIED_ROADMAP.md`, §7 POST-BETA) contains a short persistent item pointing here. Do not close or delete that roadmap item merely because LEGACY virtualization fixed the current performance blocker — close it only after V2 is the production default and every item in §6 is complete.

## 9. Decision log

### 2026-09-13

- Real long-manuscript testing exposed severe LEGACY full-DOM Preview pressure (20–34s main-thread long tasks, ~3.7GB memory warning).
- V2 was confirmed architecturally much lighter (≈12x fewer DOM elements) due to its existing virtualization.
- A full LEGACY-vs-V2 parity audit (TSP-V2-BETA-DEFAULT-PARITY-GATE-001) found V2 not yet safe as the default: per-page `hideNombre` unsupported, TOC/pagination parity unproven, and PDF/JPG export would change from raster to vector as a side effect.
- Decision: extend LEGACY's existing (previously V2-only) Preview virtualization mechanism to LEGACY itself (TSP-LEGACY-PREVIEW-VIRTUALIZATION-001), fixing the actual root cause without touching pagination, typography, or export semantics — while explicitly preserving V2 as the long-term migration target via this document.

## 10. Non-goals

This document does NOT authorize:

- immediate V2 production rollout,
- silent raster-to-vector export migration,
- removal of LEGACY,
- pagination semantics changes,
- data/schema migrations,
- changes to user project content.

Those each require their own implementation and release gate, per §5–§6 above.
