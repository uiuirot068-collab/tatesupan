# B4–B6 train — integration result

> **Revision 2 (Human QA round 1 = CHANGES REQUESTED for B4 and B5) is appended at the end (§7).** §1–§6 describe the first pass and are kept as history; where they mention the old A / A+B / A+B+C modes or the footer pill, §7 supersedes them.

Branch `feat/tsp-b4-b6-train-20260922` · base = B3 closeout `7d6e4ced6ee2e5dbe661233504038afe6a7403b7` · worktree `tate-b4-b6-train-20260922`
push NO · deploy NO · master merge NO · A4 untouched · DB/Auth/Supabase/schema/migrations/env/secrets untouched · held migration `47d66df` untouched · feedback CORS/Turnstile untouched · no reset / stash / clean / `git add .`

## 1. Item status

| Item | Status | Checkpoint commit |
|---|---|---|
| Canonical URL cleanup | **DEFERRED / LOCATION NOT REPRODUCED / NOT A B4–B6 BLOCKER** — changes: none | — |
| B4 音読β | **IMPLEMENTED / AUTOMATED QA PASS / HUMAN_GATE / NOT RELEASED** | `c19b8a3` feat(review): implement B4 read-aloud beta |
| B5 描写語・修飾表現チェックβ | **IMPLEMENTED / AUTOMATED QA PASS / HUMAN_GATE / NOT RELEASED — with BETA LIMITATION REVIEW** (heuristic analysis, no POS dictionary) | `aeccb8d` feat(review): implement B5 description check beta |
| B6 傍点 | **BLOCKED / PARITY NOT PROVEN / NOT RELEASED** (no product code changed) | `ea4c200` docs(authoring): record B6 emphasis parity decision |
| Integration | this document + `HUMAN_QA_B4_B6_JA.md` | (integration commit) |
None of B4/B5/B6 is FIXED. A B6 blocker did not erase or alter the B4/B5 checkpoints.

### Canonical URL (recorded, not actioned)
Runtime user-visible `tatespun.pages.dev` credit hits: **0**. The visible Web footer (`PageCard.tsx`) and the share/Auth text already use `https://spuntales.net/tatespun/`; the only credit-like hit is dead data (`src/lib/constants/presets.ts:123`, `PAGE_PRESETS` has zero importers). Infra/security references (beta-feedback CORS + Turnstile hostname allowlists, comments, tests) were preserved. Deferred until the Human identifies the screen/export where the two old credits were seen (the Human QA sheet asks).

## 2. Suites run (final state, HEAD `ea4c200` + the integration commit)

| Suite | Result |
|---|---|
| `src/lib` vitest config | 578 pass / **1 fail = known baseline** `exportCancellation` "topmost Escape" (identical on B3) |
| `src/components` vitest config | 179 pass |
| `src/hooks` vitest config | 22 pass |
| ESLint on every touched `src/**/*.ts(x)` | 0 errors; 4 warnings = **known baseline** (`EditorPane` `navigateToGlobalOffset`, 3× `PagedEditor` useImperativeHandle) |
| `tsc --noEmit` | clean except the pre-existing `layout.tsx` `LayoutProps` (needs `next typegen`) |
| `git diff --check` | clean |
| E2E `readAloud.e2e.mjs` (B4; 390/770/1280; fake speech engine) | **PASS** |
| E2E `descriptionCheck.e2e.mjs` (B5; 390/770/1280 + 102k-char manuscript) | **PASS** |
| E2E `reviewHub.e2e.mjs` (B1/B2: 320…1280, collapsed footer, 集中モード, pins) | **PASS** on the 4-tool build |
| E2E `reviewHubFeedback.e2e.mjs` (B3 survey; dummy backend, stubbed transport) | **PASS** (Q2 now lists all four tools; 0 requests reached a real backend) |
| E2E `mobileSharedExport.e2e.mjs` (Preview / JPG / PDF downloads, 320…1280) | **PASS** — 9 downloads verified |

## 3. Baseline failures reproduced (not fixed, not chased)
- `exportCancellation` topmost-Escape (vitest) — same failure as before B4.
- `headerTabletDensity.e2e.mjs`: fails at **906×720** "title actions on ONE row" with the beta feedback flag ON — the documented baseline (passes ≤ 900 px; identical to B2). Not caused by B4/B5 (no header change).
- `EditorPane` exhaustive-deps warning — baseline.
- Not run (environment): `editorInputIntegrity`, `editorSessionActivity`, `workSessionIsolation`, `imageInsertionPlacement` E2Es spawn their **own** `next dev` (Turbopack), which cannot start from a worktree whose `node_modules` is a junction ("Symlink … points out of the filesystem root"). Editor input/undo paths were not modified (B4 read selection only; B5 wrapped the existing cursor callback and added a read-only overlay); the B4/B5 E2Es type and select in the WINDOWED editor. `editorSessionActivity` also has a documented baseline failure.

## 4. Cross-cutting checks
- **WINDOWED editor** (`.env.local` forces `WINDOWED`): all B4/B5 E2Es ran on the paged surface; B4 reads `pagedEditorRef.getSelectionGlobal()`, B5 maps global marks to the current page (`marksForPage`).
- **Persistence**: pins (`tatespun.reviewHub.footerTools.v1`, unchanged key/format), B4 prefs (`tatespun.readAloud.v1`), B5 prefs (`tatespun.descriptionCheck.v1`) — all browser-local, verified across reload; nothing enters the manuscript/cloud data. B3's "opening/closing the Hub writes nothing" still holds (B1 E2E storage assertion passes).
- **Undo/redo touched paths**: none modified. B5 never edits the manuscript (source-tested: no `onContentChange` in the hook/driver).
- **Preview / JPG / PDF**: B4/B5 add nothing to them (source-tested: no reference from `PreviewPane`, `PageCard`, `exportCapture`, `v2BrowserExport`, `txtTransfer`); the export E2E confirms valid downloads on this build. B6 would have been the only item touching them and was not implemented.
- **Responsive 390 / ~770 / 1280**: B4 and B5 E2Es assert no horizontal scroll and panel/footer/card inside the viewport at each width; B1/B2 E2E covers 320…1280.
- **B1/B2/B3 regression**: Hub open/close/Escape/outside-press, pins (max 2, order, persistence, zero pins, unpinned still usable), 文章チェックβ toggle independence, 集中モード, survey answers and send path — all pass with four tools. Two old E2E *contracts* had to change and are recorded, not hidden: (a) B1 "panel shows all content without scrolling" → "every control is reachable (scrolls inside its unchanged cap)"; outside-press fallback to page chrome on the smallest phone; the Next dev-tools badge (`<nextjs-portal>`) is exempted from hit-testing; (b) B1/B3/B2 E2Es' hard-coded tool lists now expect the registry-driven four tools.
- **No new external manuscript transmission**: B4 and B5 E2Es record every network request; the manuscript sentinel never appears in any request URL/body, and no non-loopback non-GET request occurred in either run. Source scans assert no fetch/XHR/beacon/WebSocket/Worker/dynamic import/external URL/AI-API name in the B4/B5 modules. **B6**: no transport was introduced (nothing was implemented).
- **Dependencies**: none added (`package.json` differs only by two `test:e2e:*` script lines; `package-lock.json` untouched).
- **DB/Auth/Supabase/migrations touched: NO** (`git diff --name-only 7d6e4ce..HEAD` lists no `supabase/`, migration, `.env*` or lock file).

## 5. What is uncertain (for the Human gate)
1. Real **device voices** for B4 (Windows Chrome/Edge often have only online Japanese voices, which are deliberately not used automatically).
2. B5's **precision on real manuscripts** (heuristic; blind-run 74 % / 79 % on the author's own sentences) and whether the tool feels like "help" not "judgement".
3. Whether the Hub panel with **four tools** (internal scroll) is acceptable on small phones.
4. B6 decisions (production renderer flag, ruby-vs-dot rule, scope).
5. Where the two old `tatespun.pages.dev` credits were seen.

## 6. Local start (exact) — see `HUMAN_QA_B4_B6_JA.md`
```
cd "D:\Dropbox\neuneunet Dropbox\なつおりく\molnatu共有\□2026からサイト運営\tate\tate-b4-b6-train-20260922"
npx next dev --webpack -p 3117
```
URL: **http://localhost:3117/editor** (verified: serves HTTP 200 with the prepared ignored `.env.local`: beta feedback flag ON, editor surface WINDOWED). `--webpack` is required because `node_modules` here is a junction (Turbopack rejects it). Stop any other `next dev` started from this same folder first (per-folder lock).


## 7. Revision 2 — Human QA UX fix (B4 / B5 CHANGES REQUESTED)

Starting HEAD `2fd7e7e`; one checkpoint commit `fix(review): refine B4 B5 footer and category UX`. Untouched: B6, canonical-URL item, Supabase/Auth/DB/migrations, env, A4, production Update History, master/remote/deploy.

| Area | Result |
|---|---|
| Review Dock | New dedicated region (`ReviewDock.tsx`) as the first child of the footer stack: top separator, subtle background, padding, gap from the manuscript, cards. B4 and B5 pins render as **cards**; 文章チェックβ keeps its own strip and 文字数 its pill (B2 places preserved, below the dock). Two cards side by side at 1280, stacked at 770 / 390, `min-w-[15rem]`, no horizontal scroll, no internal scroll for ordinary controls. |
| B4 | footer card with 音読範囲 radiogroup, 「選択範囲を保持中（N文字）」, ghost highlight, derived-validity held selection, stale cleanup (edit / collapse / document key), target follows into the mobile collapsed ▶ 音読. |
| B5 | independent A / B / C (old staged mode removed; migration of stored A / AB / ABC), zero-selected valid (no analysis), three tints of one yellow family + text tags, single click / tap, pinned card with ON/OFF + A/B/C + count + 前へ/次へ + current candidate + 理由を見る; floating detail card only when the tool is not pinned. |
| **B1 internal-scroll contract** | **PENDING HUMAN ACCEPTANCE.** The first-pass E2E relaxation ("no internal scrolling" → "every control reachable") is still only *recorded*, not adopted as the new B1 contract; the Human decides whether the Review Hub panel scrolling inside its unchanged cap with four tools is acceptable (question in the Human QA sheet §3). The footer Review Dock does not rely on internal scrolling for ordinary controls (asserted: `dock.scrollHeight − clientHeight ≤ 1` in every combination). |

### Tests (final state of Revision 2)
| Suite | Result |
|---|---|
| `src/lib` / `src/components` / `src/hooks` vitest configs | 613 pass + 1 known baseline (`exportCancellation`) / 217 / 22 |
| new / rewritten unit files | `descriptionCheck.test.ts` (independent categories, migration, first-enable, zero, persistence round-trips, wording), `descriptionCandidateNav.test.ts` (previous/next/wrap, category segments), `readAloudHeldSelection.test.ts` (capture, derived validity, lifecycle), `descriptionCheckControls.test.tsx`, `readAloudDockCard.test.tsx` (targets, held/need-selection/never-phantom, ghost wiring, dock layout) |
| ESLint (touched files) / `tsc` / `git diff --check` | 0 errors, the 4 known baseline warnings only / clean except pre-existing `LayoutProps` / clean |
| E2E `readAloud.e2e.mjs` (B4; 390/770/1280) | **PASS** — dock card, target switching, held selection + ghost, edit/collapse/target-switch cleanup, real double-click selection, play/pause/resume/stop, max-2, persistence |
| E2E `descriptionCheck.e2e.mjs` core / dock / long | **PASS** — independent combinations (B only, C only, A+C…), tint alpha order, text tags, single click + touch tap, none-selected, migration of old modes, persistence, card ON/OFF + A/B/C + 前へ/次へ + 理由を見る + navigation lands (WINDOWED) + phone blur/ghost, coexistence with 文章チェックβ and B4's ghost; 102k-char manuscript: analysis 0.8 s, typing unaffected |
| E2E `reviewDock.e2e.mjs` (0 / single / 5 pair combinations × 390, 770×900, 770×720, 1280) | **PASS** — dock only when B4/B5 pinned, separation gap + border, dock above the editor's own footer rows, side-by-side ≥1200 / stacked ≤800, no card squeezed, no overflow, no internal scroll, manuscript keeps a usable height; max-2 / unpin frees / order / reload persistence / Hub lists all four |
| E2E `reviewHub.e2e.mjs` (B1/B2), `reviewHubFeedback.e2e.mjs` (B3, dummy backend), `mobileSharedExport.e2e.mjs` (Preview/JPG/PDF, 9 downloads) | **PASS** |
| Baseline reproduced | `exportCancellation` (vitest); `headerTabletDensity` fails at 906×720 with the beta flag on (identical) |
| New failures | none |

Measured dock geometry (px; `evidence/review-dock-geometry-*.json`): at 770×900 the manuscript keeps 238 px with both cards stacked (dock 166 px) and 312–323 px with one card; at 1280×720 both cards sit side by side.

### Harness notes (not product changes)
Layout-shift races were fixed in the E2Es, not hidden: the Hub panel's height cap is re-measured one frame after the footer changes height (ResizeObserver), so the harness waits 350 ms before tapping ✕; the Hub's "held selection" line was moved *below* the mode buttons in the Hub so it can never shift a button between pointer-down and pointer-up.

### Known limits carried into the Human gate
- 音読β held-selection ghost and the B5 navigation ghost share one light-blue layer; on desktop the editor's own selection is also visible (harmless overlap).
- On a real phone the software keyboard behaviour after 前へ/次へ (editor blurred to protect the footer) can only be confirmed on a device.
- With four tools the Review Hub panel still scrolls internally (B1 contract pending Human acceptance, above).
