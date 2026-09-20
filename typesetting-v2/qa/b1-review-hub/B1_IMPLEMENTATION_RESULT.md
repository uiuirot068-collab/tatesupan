# B1 Review Hub / 見直し — implementation result (2026-09-21)

**Status (updated 2026-09-21, after Human QA): `FIXED / RELEASE-CANDIDATE READY / NOT RELEASED`.** Human QA: all B1 functions PASS; one responsive observation at ~770px was investigated (§8) — part of it was a B1 regression and is fixed, the rest is a pre-existing header-density item recorded separately (`OBSERVATION_770PX_HEADER_DENSITY.md`). Not pushed, not deployed, not merged, not Production PASS. The original checkpoint text below is kept as written; where §8 changes a fact, §8 wins. A4 soak (Frozen RC `9b3c228` / `d58a371b`, `origin/master` `6dc820e`) is untouched.

| | |
|---|---|
| Base | `6dc820e64d1ab91e32e35ba8be3e29625d164679` (verified with `git ls-remote` before creating the worktree; no fetch) |
| Branch | `feat/tsp-b1-review-hub-20260921` |
| Worktree | `…/tate/tate-b1-review-hub-20260921` (isolated; `node_modules` is a junction to a sibling worktree's — remove the junction with `rmdir`, not a recursive delete, before deleting this worktree) |
| Contract | roadmap §37 Addendum A + B1 (`TateSpun_BETA_UNIFIED_ROADMAP.md`) |

## 1. What already existed and was reused (nothing duplicated)

| Need | Existing source | Reuse |
|---|---|---|
| Footer | `EditorPane.tsx` only (three surfaces: mobile one-line `data-editor-footer-collapsed`, 文章チェックβ bar `data-writing-check-surface`, status row `data-editor-status-surfaces`) | Left byte-for-byte; the Hub is added around/inside them |
| Top toolbar | `EditorPane.tsx` `[data-editor-secondary]` = 設定・オプション・メモ・ヘルプ | Untouched |
| 文章チェックβ on/off | `useWritingCheckEnabled` (localStorage `tatespun_writing_check`, default **ON**) | The Hub toggle calls the same `setWritingCheckEnabled` |
| 文章チェックβ results / settings | `WritingCheckBar` result popover; `WritingCheckSettingsPanel` (`settingsOpen`) | Hub buttons open those same surfaces (one optional prop `resultsRequestNonce` added to the bar) |
| Issue counts | `writingIssuesForContent` → severity split | One shared pure `summarizeWritingIssues()`; the bar now uses it too |
| Character count | `visualLength` = debounced `countVisualLength` (`EditorPane`, exactly one call site) | Passed to the Hub as a prop; **no second counter** |
| Focus mode / mobile keyboard | `focusMode`, `keyboardActive` props hide all footer surfaces (`max-md:hidden md:hidden`, `!keyboardActive`), pinned by existing tests | Hub trigger lives inside those surfaces; the Hub is also force-closed on those flags |
| Panel primitive | none fits (ViewportModal = modal; the bar's popover is `absolute bottom-full`) | Same `absolute bottom-full` pattern as the bar's popover |

## 2. Implementation

New: `src/lib/reviewHub.ts` (pure model + tool registry), `src/lib/writingCheckSummary.ts`, `src/hooks/useReviewHubDisclosure.ts`, `src/components/ReviewHub.tsx`. Changed: `EditorPane.tsx` (wrapper `data-editor-footer` + two triggers + panel), `WritingCheckBar.tsx` (shared summariser + `resultsRequestNonce`), `package.json` (`test:e2e:review-hub`).

- **Registry / extension point.** `ReviewHubToolId` union + `REVIEW_HUB_TOOLS` + `Record<ReviewHubToolId, ReactNode>` sections (a missing section is a compile error). Only `writing-check` and `character-count` exist. No B4/B5 placeholder, no coming-soon text, no clickable stub.
- **Not built (by contract):** B2 pinning/favourites/slots/`フッターに表示`/any persisted Hub preference (open state is session-only, no storage access — tested), B3 questions, B4/B5 tools, B6 傍点, any Update History change.

## 3. Exact user-visible behaviour

1. Every normal Editor state shows a small `▶ 見直し` button at the footer: on desktop at the right end of the one-line 入力記法 hint row above the counters (moved there by the §8 FIX; it originally sat left of the character-count pill) and, on a phone with the one-line footer, just before `▲`. **The top toolbar is still exactly 設定・オプション・メモ・ヘルプ.**
2. Tapping it opens a compact panel **upward from the footer** (arrow turns up, `aria-expanded=true`). Heading `見直し`, a `✕`, then two tools:
   - **文章チェックβ** — `文章チェックβを使う` checkbox (same on/off as the footer's checkbox); when on: the candidate summary in the bar's wording (`事故確認 N件 ／ 確認推奨 M件` / `確認候補なし`), `確認候補を見る` (only when there are candidates → opens the bar's existing result list) and `⚙ 設定` (opens the existing settings dialog).
   - **文字数カウント** — `現在の原稿文字数 12,843文字`, the same value as the footer pill (updates live).
3. Opening never moves focus. It closes on: the trigger again, `✕`, `Escape` while focus is in the Hub (focus returns to the trigger; never during IME composition), or a press anywhere outside (so clicking back into the manuscript dismisses it and typing continues there).
4. 集中モード and the mobile on-screen keyboard hide the footer today; the Hub is hidden with it and comes back **closed**.
5. The existing 文章チェック β bar, the footer character pill, `▲/▼` and the work-session counter are unchanged and remain the existing access routes (no relocation, no deprecation).
6. Panel size: width = own content, ≤ 22rem and never wider than the Editor pane; height = own content (~220px), never leaving the Editor pane. On any screen where the content fits over the manuscript (375×667 and larger) it does not cover the title/undo-redo/設定 rows.

## 4. Evidence (all local)

| Check | Result |
|---|---|
| New `src/components/reviewHub.test.tsx` (Node, `renderToStaticMarkup` + source contracts) | **36 / 36 PASS** |
| `src/components` suite | 8 files, **120 / 120 PASS** |
| `src/hooks` suite | 22 / 22 PASS |
| `src/lib` suite | 372 PASS + **1 known baseline failure** (`exportCancellation.test.ts` "topmost Escape" — pre-existing, not reopened) |
| Existing footer/focus/IA pins (`postBlockerUx`, `rcPolishRound4/5/6`, `keyboardCompactLayout`, `rcUiInformationArchitecture`, `demoPlacement`) | 92 / 92 PASS before and after |
| `tsc --noEmit` | exit 0 |
| ESLint on the 8 changed/new files | **0 errors**, 1 warning that exists identically on the base (`navigateToGlobalOffset`). React-Compiler `react-hooks/refs` errors introduced mid-way were fixed (destructured hook result). |
| **New real-browser E2E** `tests/e2e/reviewHub.e2e.mjs` (local dev server, dummy Supabase URL, throw-away Chrome profile, normal `/editor`) | **PASS**: 320×568, 375×667, 390×844, 430×932, 768×1024, 1280×720 · one-line footer at 320/375/390/430 · 集中モード at 1280 and 390 |
| Existing E2E `mobileSharedExport.e2e.mjs` on the changed tree (FQ-04 keyboard-compact chrome, 集中モード, exports) | PASS (9 downloads verified) |
| `git diff --check`, scope, Update History JSON | see the commit gate below |

The E2E asserts (real DOM/computed style/real input): top toolbar = 4 items, no Hub item; trigger is a `BUTTON` with `▶ 見直し`, `aria-expanded`, `aria-controls` resolving to the panel; panel opens above the footer, fully inside the viewport and Editor pane, does not resize/shift the textarea, shows all content without scrolling; no focus steal; Escape (from panel and from trigger) and outside press close it and typing lands in the pressed field; Hub count == footer pill live (also with 1,290 and 12,843 chars); Hub toggle drives the very same footer checkbox and storage key; `確認候補を見る` opens the existing list, `設定` opens the existing dialog — also from the one-line footer, which the Hub first expands (its own `▲` action); opening/closing writes no `localStorage` key; 集中モード hides the Hub and it returns closed; no uncaught page error or native dialog.

### Defects the real browser found and that were fixed before this checkpoint
1. **320×568, expanded footer:** the panel was capped by the manuscript area (only ~93px) so its controls were scrolled out of reach. → Height is now the content height, capped by the space between the Editor pane top and the footer; content fits without scrolling.
2. **768×1024:** the Editor pane is only ~334px wide but the panel was a fixed 352px, so its left edge and checkbox were **clipped** by the pane's `overflow-hidden`. → `md:max-w-[calc(100%-1rem)]`.
3. **Mobile one-line footer at 320px:** the trigger squeezed the *existing* count (`現在12,843字` fit before B1). → tighter compact trigger (`gap-0 px-1`) and the two decorative `｜` dividers hide below 360px. Re-measured: **≥ 360px: no truncation up to 100,000 chars; 320px: ≤ 999 fits, 5 digits clipped by 2px, 6 digits by 5px by the row's own existing `truncate`** (the full value is in the Hub). See decision D1.

## 5. Not verified here (honest limits)

- **Physical phone** (software keyboard open, real touch, iOS Safari): never observed — only Chrome DevTools emulation. The keyboard-open path is covered by the pure rule + existing FQ-04 harness, not by a real keyboard.
- **Production build / basepath build:** not run (no need for a HUMAN_GATE checkpoint; the local dev server rendered and hydrated `/editor` with no page error). Run the existing gate before any release.
- **Demo route:** its own STEP card (fixed, `z-60`) can sit over the footer on a phone and hide the Hub panel; this is the tour's existing overlay. The E2E therefore uses the normal editor; the Demo tour's script was not changed.
- **Loop-independence:** B1 does not touch B2–B6; but `public/data/tatespun-update-history.json` must change at release (see the release-note draft) and that alters the history hash the A4 observer pins.

## 6. Design decisions that need the Human (also in the QA template)

- **D1** 320px one-line footer: accept the 2px/5px truncation of a 5–6-digit count (only at exactly 320px), or hide the trigger's arrow there.
- **D2** `確認候補を見る` / `⚙ 設定` from the one-line footer **expand it** (the same action and persisted preference as its `▲`), because the result list and settings host live in the hidden bar. Accept, or prefer that the Hub only offer the toggle + count there.
- **D3** On a very short screen with the expanded footer (~568px high) the panel rises over the title/undo-redo rows (only as far as needed). Accept, or require the one-line footer form on such screens.
- **D4** Other already-shipped tools that *might* belong in the Hub — **not added**: 作業カウンター (`WorkSessionTracker`), 完成前マイチェックリスト (Options drawer), 検索・置換 (action row), the 入力記法 help line. Which, if any, move in B1?
- **D5** Copy: `文章チェックβを使う`, `確認候補を見る`, `現在の原稿文字数`; the tool one-liners; the explanatory lead sentence was deliberately dropped for density.
- **D6** 文章チェックβ stays **default ON** (existing behaviour). B1 does not change it; the roadmap's "optional/default-OFF where appropriate" is not applied to an already-shipped default.
- **D7** Trigger position: desktop = right end of the 入力記法 hint row (after the §8 FIX; originally left of the count pill, which wrapped the controls row at 768–~905px) / one-line footer before `▲`.

## 7. Soak compliance
No product deploy, no push, no master merge, no Update History change, no DB/Auth/Supabase/env/migration change (the local dev server used a dummy `NEXT_PUBLIC_SUPABASE_URL`, never a real project), `47d66df` untouched, Frozen RC / release worktrees untouched.

## 8. FIX pass — the ~770px header-density observation (2026-09-21)

**Human QA feedback:** all B1 functions PASS; one observation — around 770px the large Editor header feels dominant and compresses the Editor/Preview workspace (Review Hub not clipped, top toolbar correct).

**Question:** pre-existing on base `6dc820e`, or introduced/worsened by B1? Method: the same probe (real DOM rects via CDP, disposable Chrome profile, `mobile:false` ≥ 768px, no persisted state) against base `6dc820e` (its own worktree, dev server :3102) and B1 (dev server :3001), same viewports.

### Result: **SPLIT — the header is PRE-EXISTING; a footer line at 768–~905px was a B1 REGRESSION**

| @770×720 | base `6dc820e` | B1 `505a337` (before fix) | B1 after fix |
|---|---|---|---|
| App-shell header | 146px | 146px | 146px |
| Editor pane header | 166px | 166px | 166px |
| Footer block (writing-check bar + status rows) | 125.5px | **152.1px (+26.6)** | 125.5px |
| Manuscript textarea | 152.5px | **125.9px (−26.6, −17%)** | 152.5px |
| Footer controls row | 1 line (19px) | **2 lines (45px)** | 1 line (19px) |

- Header/pane-header heights are identical on base and B1 → that "dominant header" is **pre-existing**, recorded separately in `OBSERVATION_770PX_HEADER_DENSITY.md`. B1 did not touch it and no header change was made.
- **Cause of the B1 part:** in the 768–900px split the Editor column is ~335–400px wide, so the footer controls row (作業カウンター 152px + gap 12 + `現在の原稿文字数 N文字` pill 135px = 299px) had 303px at 770px — it fit by 4px. B1 added the 66px `▶ 見直し` trigger to that row (371px needed) so it wrapped: one extra footer line, taken from the manuscript. Affected range: ~768 to ~905px wide; ≥ 1000px only +1.9px (trigger 21px vs pill 19px), which the fix also removes.
- Sweep after the fix (base vs B1, textarea / footer block): 768 152.5/125.5 = 152.5/125.5; 770×900 332.5 = 332.5; 770×600 32.5 = 32.5; 800 205.9/112.2 vs 205.9/112.1; 850 same; 900 239.9/112.2 vs 239.9/112.1; 1000 same; 1280 279.9/112.2 vs 279.9/112.1. No horizontal scroll at any width.

### Smallest B1-only correction
Only the **desktop** (md+) trigger moved: from the right cluster of the controls row to the row above it — the existing one-line, already-truncating 入力記法 hint row (`EditorPane.tsx`: `<div class="flex min-w-0 items-center gap-2">` around the untouched `data-ruby-tcy-status` hint + trigger, right-aligned). The hint keeps `min-w-0 flex-1` so it alone gives up width (its full text stays in its `title`/dialog). `ReviewHubTrigger` gained an optional `flush` prop (`py-px`) so the button fits the ~20px hint row without growing it. The controls row is byte-for-byte its pre-B1 content again. The mobile one-line footer trigger, the panel, behaviour, focus handling, the pill text/`title` (pinned by existing tests) and the top toolbar are unchanged. No header/toolbar/shell change; no new dependency; no storage.

**Visible delta for the Human (not a behaviour change):** on desktop the `▶ 見直し` button is now at the right end of the hint line above the counters instead of immediately left of the character pill. This is decision **D7**; please glance at it once. If preferred, the alternative that keeps the old position is to shorten the pill, which would touch a pinned existing element and is deliberately not done here.

### Tests
- `reviewHub.test.tsx` **37/37** (+1: the trigger must be in the hint row, not the controls row; `flush` trims vertical padding only). `src/components` **121/121**, `src/hooks` **22/22**, `src/lib` **372 pass + 1 known baseline failure** (`exportCancellation` "topmost Escape", pre-existing, identical on base). `tsc --noEmit` exit 0; ESLint 0 errors (the same 1 pre-existing warning).
- Real-browser `reviewHub.e2e.mjs` extended with **770×720 and 900×720** (full phase-1 contract) and a new assertion for desktop widths: controls row ≤ 26px (one line; the regression measured 45px), trigger above the controls row, trigger no taller than the hint row. **PASS**: 320, 375, 390, 430, 770, 900, 768×1024, 1280; collapsed one-line footer 320/375/390/430; 集中モード 1280 + 390.
- Existing `mobileSharedExport.e2e.mjs` PASS (9 downloads). Existing `editorSessionActivity.e2e.mjs` **fails identically on base `6dc820e` and on B1** under this local setup (`notStrictEqual` on the counter text, "現在の原稿文字数 0文字" both sides) — pre-existing/environmental, not caused by B1 or this fix, not investigated further here.
