# TateSpun Editor State Architecture (Phase 6)

Audit of editor state ownership, async lifecycles and document scoping, 2026-09-26,
branch `tsp-post-beta-typography-phase1` (base `c1afa1f`). This document is based on
the source. Line numbers are approximate and refer to the Phase 6 commit. Earlier
phases are recorded in `docs/TATESPUN_V2_CANONICALIZATION_AUDIT.md`.

Legend: **A** source of truth · **B** derived · **C** async computed · **D** cache ·
**E** transient UI · **F** persisted local · **G** cloud-synced · **H** legacy/fallback.

---

## 1. State ownership map

```
/editor?id= | ?cloudId= | ?demo=1          (same component instance; props change in place)
  └─ TategakiEditor ── document state (A/F/G), image technical state, selection, modals
       ├─ EditorPane (live text input, caret)      ← content, onContentChange, onCursorIndexChange
       └─ PreviewPane (React.memo)                 ← previewContent (debounced), getLatestContent
            ├─ LEGACY paginator (pages, pageSourceRanges)              H
            ├─ useV2PreviewAdapter → worker → {bridge, preview, input} C
            ├─ v2PageModel → listPages / listSourceRanges             B
            ├─ image-warning acknowledgment store (scoped)            A (per document scope)
            └─ export lifecycle (ExportCancellationCoordinator, plan cache, PDF worker handle)
```

## 2. Main data-flow graph

```
keystroke → EditorPane → setContent (TategakiEditor, A)
   ├─ liveContentRef  (effect-synced; getLatestContent for export and splices)
   ├─ autosave effect (1500 ms) → IndexedDB saveDocument                         F
   ├─ manifest poll effect (cloud + images) → unresolvedCloudImages              G→A
   └─ 180 ms → previewContent → PreviewPane.content
         └─ 180 ms → deferredContent
               ├─ LEGACY tokenize/paginate + computePageSourceRanges             H
               └─ useV2PreviewAdapter: 180 ms → new Worker → compose → setState  C
                     └─ v2PageModel → listPages, listSourceRanges, presentation,
                        imagePageIndicesById, onBodyPageCountChange              B
```

## 3. Async flow graph (with guards)

| Flow | Steps | Stale-result guard |
|---|---|---|
| A typing → layout | Editor 180 ms → Preview 180 ms → adapter 180 ms → worker | effect `cancelled` + `worker.terminate()` on every input change; `gate.currentFor` skips equal input |
| B export | click → `awaitComposition(currentCompositionInput())` → plan cache → export | `CompositionGate` (exact input match); supersede effect rejects waits when the source changes |
| C project open | `getProjectById` → `restoreManuscriptImages` ∥ `loadAllImages` → merge → unresolved + baseline | load-effect `cancelled`; **`beginDocumentSwitch` (Phase 6)** |
| D image replace | FileReader → saveImage → sync → manifest → unresolved | **`documentEpoch.capture()` (Phase 6)** |
| E page reorder | `buildReorderedContent(listSourceRanges)` → setContent | `listRangesAreCurrent` + **snapshot == live (Phase 6)** |
| F project switch | route props change → load effect; 保存作品一覧 → `applyCloudProject` | **`beginDocumentSwitch` (Phase 6)** |
| cloud save | plan/count → create/update → sync → project link + unresolved | **`documentEpoch.capture()` (Phase 6)** |
| image insert | PSD/file decode → fitImageToMm → splice | **post-await snapshot == live (Phase 6)** |

## 4. Source-of-truth table

| State | Owner | Class | Notes |
|---|---|---|---|
| manuscript text `content` | TategakiEditor | A/F/G | Only writer is `setContent`. PreviewPane edits go through `onContentChange` |
| `title`, `plotNote` | TategakiEditor | A/F | `plotNote` only in IndexedDB |
| `settings` | `useEditorSettings` | A/F/G | also mirrored to localStorage as "last used" |
| `images` (id → dataURL) | TategakiEditor | A/F | **one pool shared by every document** (`loadAllImages`). Ids are unique, so sharing is safe |
| `imageLayerOrder` | TategakiEditor | A/F | separate from content/markers |
| `docId` / `loadedDocIdRef` | TategakiEditor | A | `loadedDocIdRef` is the autosave document guard |
| `currentProjectId` | TategakiEditor | A (G link) | the cloud project the open document saves to |
| `unresolvedCloudImages` | TategakiEditor | A (technical) | from restore / manifest poll / sync. Cleared by repair or 通知解除 |
| `imageWarningBaselineIds` | TategakiEditor | A | ids that were already broken when the document opened (silent) |
| image acknowledgment | PreviewPane `imageWarningStore` | A | `{scope, state}`; `imageWarningsForScope` |
| `selectedPages` | TategakiEditor (lifted) | E | body indices of the current Preview list |
| `cursorIndex` | TategakiEditor | E | EditorPane reports it; debounced to `previewCursorIndex` |
| `mobileView`, `focusMode`, drawers/modals | TategakiEditor | E (focusMode F) | `useMobileFocusMode` = localStorage |
| export running/progress | PreviewPane | E | `ExportCancellationCoordinator` owns the signal |
| renderer mode | `useV2Engine` (env) | constant | dev = V2; prod = `v2Rollout` (LEGACY rollback kept) |

## 5. Derived-state table

| Derived | From | Where |
|---|---|---|
| `previewContent` / `deferredContent` | `content` (debounce ×2) | copy-by-effect, deliberate (memo/latency) |
| `previewCursorIndex` | `cursorIndex` (debounce + PREVIEW_TO_EDITOR echo suppression) | TategakiEditor |
| `layout` | `settings` | `computePageLayout` memo |
| `unresolvedImageIdSet` | `unresolvedCloudImages` | memo (reference-stable for PageCard) |
| `v2PageModel`, `listPages`, `listSourceRanges` | adapter `bridge` + `input.content` | PreviewPane memo (LEGACY until the first V2 layout) |
| `listRangesAreCurrent` | `v2PageModel.sourceContent === content` | render |
| `imagePageIndicesById`, `blockedExportPageSet` | page model + warnings + technical ids | memo |
| image warnings (reconcile) | technical ids + page map + baseline | adjusted during render (pure reducer, settles in one pass) |
| `bodyPageCount` (Editor copy) | `listPages.length` | reported by one effect in PreviewPane → ColophonModal hint only |
| `presentation`, `spreadGroups` | page model + colophon settings | memo |
| export plan | (bridge, font, layerOrder) | `ExportPlanCache` (D) |

## 6. Persisted vs transient

- **IndexedDB** (`lib/db.ts`): document {title, content, settings, plotNote}; image records {dataUrl, layerOrder}.
- **localStorage**: last-used settings, focus mode, PDF notice preference, memo drafts (keyed by document), PDF checklist attempt, review pins.
- **Supabase**: project {title, content, settings}; manuscript image manifest + 72 h Storage copy.
- **Transient**: selection, caret, zoom, drawers/modals, export progress, warnings acknowledgment
  (acknowledgment is per session and per scope and is **not** persisted).

## 7. Document-scoping rules

1. The editor is **not remounted** on document change. Every document change goes through
   `beginDocumentSwitch()` (route-driven load effect, 保存作品一覧). It advances `documentEpoch`
   and clears `unresolvedCloudImages`, `imageWarningBaselineIds` and `selectedPages`.
2. A local-document load also clears `currentProjectId`. Before Phase 6, a `?cloudId=` →
   `?id=` prop change left the previous cloud project linked, so クラウドに保存 would
   overwrite that project with the local document.
3. Acknowledgment state is keyed by `imageWarningScope` (= work-session scope `local:/cloud:/demo:`).
   Another scope reads as empty without a reset effect.
4. The image pool and IndexedDB image store are global by design. Writing a repaired image after a
   switch is harmless; writing *technical state* after a switch is not.
5. Autosave schedules only when `loadedDocIdRef.current === docId` (pre-existing). Since
   Phase 6.1 the scheduled save is a job that carries its own `docId` (§12.1).
6. **Document-switch persistence contract (Phase 6.1).** Before the open document is replaced
   (route load effect, 保存作品一覧), its pending autosave job is flushed to *its* `docId`.
   A route load of a local document awaits that flush before `loadDocument` (A → B → A reads
   A's last edit). The route load also captures `documentEpoch`, so a project opened from
   保存作品一覧 while a route load is in flight is not overwritten by that load.

## 8. Race-prevention contracts

- **Layout**: one adapter state; each composition effect run owns its worker and ignores it
  after cleanup. An old layout can therefore never replace a newer one.
  `v2PageModel.sourceContent` records which text the list describes.
- **Export**: exports only a composition whose input equals the source at click time
  (`CompositionGate`). A wait is rejected when the source moves on, including a project switch
  (`src/lib/documentScope.test.ts`).
- **Handler async (Editor)**: `const isSameDocument = documentEpoch.capture()` before the first await.
  Every *document-state* write after an await is gated by `isSameDocument()`. User-facing alerts
  about the requested operation still show.
- **Source splices (Preview)**: range-based splices (reorder, image insert) require
  `listRangesAreCurrent && readLiveContent() === content`. Otherwise they are refused with
  LAYOUT_UPDATING_MESSAGE, as the existing stale-layout refusal already did. For image insert,
  the check runs **after** the decode awaits and **before** `onImageAdd`, so a refusal leaves no
  orphan image. Marker-based splices (image position/delete) splice `readLiveContent()`.

## 9. Safe extractions completed (Phase 6)

| Change | Why |
|---|---|
| `src/lib/documentScope.ts` `DocumentEpoch` | explicit document identity for handler-level async work |
| `beginDocumentSwitch` in TategakiEditor | one owner for "document changed" resets (was split between branches and missing in two) |
| `withoutUnresolvedImageIds` (cloudImageSync) | one removal rule; it was duplicated in replace and dismiss. Returns the same object when nothing changed |
| `imageWarningsForScope` (imageWarningLifecycle) | named, tested scope selector (was inline) |
| `readLiveContent` in PreviewPane | the snapshot-vs-live rule for source splices |

Tests: `src/lib/documentScope.test.ts` (semantic) and `src/components/editorDocumentScope.test.ts`.
The second is a source contract, because this repo has no DOM test environment.

## 10. Remaining high-risk areas

Items 1–6 of the Phase 6 list were fixed in Phase 6.1 (§12): autosave flush, 保存作品一覧
image restore, selection pruning, export cancel on unmount, userSelect cleanup, and the stale
`imageWarningLifecycle.ts` header.

7. A local document that is cloud-saved gets `currentProjectId` only in memory. After a reload,
   the next クラウドに保存 creates a new project (pre-existing product behaviour).
8. Unload protection is best effort. `pagehide` / `visibilitychange=hidden` start an IndexedDB
   write, which is async. A tab killed right after it is hidden can still lose the last ≤1.5 s.
   Nothing is sent to the cloud on unload. A cloud project opened via `?cloudId=`/保存作品一覧 has
   no local autosave at all (pre-existing: `docId` is null), so there is nothing to flush.
9. An autosave flush that fails after a switch sets `saveStatus = "error"` on the *new* document
   (logged to the console). The failed edit is not retried.

## 11. Recommended future refactors

- `useV2LayoutLifecycle`: the adapter plus `v2PageModel` plus supersede effect as one hook with a
  `{layout, sourceContent, isCurrentFor(content)}` contract.
- `useImageTechnicalState`: `unresolvedCloudImages`, baseline, poll, replace, dismiss, and the
  Phase 6.1 cloud restore (`openCloudProjectImages`) in one hook, keyed by document epoch.
- `useAutosave`: the Phase 6.1 job, timer, flush and lifecycle listeners in one hook.

## 12. Phase 6.1 document-safety contracts

### 12.1 Autosave flush ownership

- `src/lib/pendingAutosave.ts` `PendingAutosave`: the debounced save is a **job**
  `{docId, title, content, settings, plotNote}` built from the committed state (the live
  `content`, never the debounced `previewContent`). The autosave effect schedules it. The effect
  cleanup cancels only the timer, and the job stays pending.
- A job is taken **once**, by the 1.5 s timer or by `flushAutosave()`, and is always written to
  its own `docId`. So a late flush can never write A's data into B.
- `flushAutosave()` runs on: the route load effect (before `beginDocumentSwitch`), 保存作品一覧
  (`handleSelectProject`), unmount, `pagehide`, and `visibilitychange` → hidden. Ctrl+S
  (`saveNow`) clears the job it replaces. Nothing pending means no write.

### 12.2 Saved-project image restoration

- `openCloudProjectImages(project, isCurrent)` is the ONE restore for both cloud-open paths
  (`?cloudId=` and 保存作品一覧). The pure helper `openedCloudProjectImageState`
  (cloudImageSync) keeps only the images the manuscript references: cloud copy, else this
  browser's original. It also keeps their locally persisted `layerOrder` (the cloud does not store
  it) and the silent baseline of ids already broken at open.
- While a restore runs, `cloudImagesRestoring` holds the manifest poll back. Until then `images` is
  still the previous document's pool, so the poll would announce this project's images as broken.
  `beginDocumentSwitch` resets it, and a superseded restore writes nothing (`isCurrent`).
- A restore request that throws is treated like a manifest error: every referenced image is
  unmanifested, and local originals still apply.

### 12.3 Page-selection pruning

- `pruneSelectedPages(selected, pageCount)` (pageOrder): `selected ∩ [0, pageCount)`. It returns
  the same set when nothing changes. PreviewPane runs it when `listPages.length` changes, **only
  when the list is canonical** (`!useV2Engine || v2PageModel`). The LEGACY fallback before the
  first V2 layout or on V2 HOLD must not prune V2 selections.
- Selection semantics are otherwise unchanged: valid indices stay, a document switch still clears.

### 12.4 Export worker cleanup

- PreviewPane's unmount effect calls `ExportCancellationCoordinator.dispose()`. This follows the
  same path as 中止: the signal aborts, the V2 PDF worker is terminated through its abort listener,
  and every download path already waits at `waitForExportPermission(signal)` right before saving.
  An export still preparing its plan gets an already-aborted, untracked signal from `begin()`.
  The V2 PDF path checks it before starting a worker. `activate()` undoes `dispose()` for the
  StrictMode effect re-run.
- Limitation: work that is already running synchronously (a page capture) finishes, but nothing
  after it downloads.

### 12.5 Unmount cleanup

- `lockUserSelect(style)` (`src/lib/bodyUserSelect.ts`) returns an idempotent release that
  restores the previous value. The divider drag (TategakiEditor) and the Preview pan release it on
  mouseup/pointerup **and** in their unmount cleanup.

Tests: `src/lib/pendingAutosave.test.ts`, `src/lib/documentSafetyHelpers.test.ts`,
`src/lib/exportUnmount.test.ts` (semantic), `src/components/editorDocumentSafety.test.ts`
(wiring contract).

## Performance observations (for the Long Manuscript Performance phase)

- **Manifest poll runs on every keystroke.** The effect depends on the live `content`, so for a
  cloud project with images each keystroke re-runs it and makes an immediate
  `getUnresolvedManuscriptImages` request (in addition to the 60 s interval).
- In V2 mode PreviewPane still runs the full LEGACY `tokenizeTategaki` + `paginateTokens` and
  `computePageSourceRanges` on every debounced change. They are needed only as a fallback until the
  first V2 layout.
- A new Worker is spawned per composition, and the whole `images` pool (data URLs of every document)
  is structured-cloned into it each time.
- `compositionInputsEqual` compares settings with `JSON.stringify` and images by value; it runs per
  composition and per waiter.
- `pageSignatures` detokenizes every page on each list change.
- There are three stacked 180 ms debounces before the worker starts, so layout latency is
  ≥540 ms plus compose time.
- `loadAllImages` decodes and holds every stored image of every document on each local open.
