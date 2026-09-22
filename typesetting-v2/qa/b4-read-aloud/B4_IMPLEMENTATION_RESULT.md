# B4 音読β / リズム確認 — implementation result

Status: **IMPLEMENTED / AUTOMATED QA PASS / HUMAN_GATE / NOT RELEASED** (not FIXED — Human QA pending)
Branch: `feat/tsp-b4-b6-train-20260922` (base = B3 closeout `7d6e4ce`) · push NO · deploy NO · master merge NO · A4 untouched
DB / Auth / Supabase / migrations: **not touched** (no schema, env, Edge Function or secret change)

## 1. Contract (roadmap B4 / Addendum F)

Proofreading / rhythm confirmation, **not** audiobook production. Selection / current paragraph / full manuscript; play, pause/resume, stop, speed; browser/device speech synthesis; no external speech service or upload; no cloud-voice dependency; VOICEVOX = future research only; Review Hub tool (no fifth top menu); nothing reads automatically.

## 2. Architecture

| Layer | File | Responsibility |
|---|---|---|
| pure text/voice model | `src/lib/readAloud.ts` | manuscript → speakable text via the app's own tokenizer (`tokenizeTategakiWithOffsets`): ruby → its reading (rt), 縦中横 → its characters, 挿絵 skipped, 改ページ → pause. Range resolution for selection / paragraph(line at caret) / full. Sentence chunking (。！？…, line ends; ≤160 chars, cut at 読点). Speed clamp 0.5–2.0. **Voice policy** `chooseReadAloudVoice`. |
| controller | `src/lib/readAloudEngine.ts` | environment-injected state machine around `SpeechSynthesis`: sentence-by-sentence utterances, run-id guard, pause/resume/stop, speed/voice change, `voiceschanged` + 1.5 s fallback, browser-local prefs (`tatespun.readAloud.v1`: speed + explicit voice only) |
| React binding | `src/hooks/useReadAloud.ts` | `useSyncExternalStore`; cancels on unmount, on document change (`memoStorageKey`), on `pagehide` |
| views | `src/components/ReadAloudControls.tsx` | Hub section + compact footer control (presentational) |
| registration | `src/lib/reviewHub.ts` (`REVIEW_HUB_TOOLS` + id), `src/lib/reviewHubFooterPins.ts` (pin id), `ReviewHubFooterPinnedTools.tsx`, `EditorPane.tsx` (one controller, `sections["read-aloud"]`, footer control) |

Selection source (both surfaces): WINDOWED → `pagedEditorRef.getSelectionGlobal()`; legacy textarea → `selectionStart/End`. Read **only at the moment of a button press** (the selection survives the textarea blurring). "Current paragraph" = the line containing the selection start.

### Privacy (the important decision)
The Web Speech API can hand text to a **cloud** voice (`localService === false`, e.g. Chrome "Google 日本語", Edge "…Online (Natural)"). To honour "no external speech service":
- default = first **on-device Japanese** voice; online voices are never picked automatically;
- with no on-device Japanese voice the tool **does not speak** and says so (it never falls back to the browser default voice);
- an online voice can only be chosen explicitly from the 音声 selector (grouped as 「オンライン音声（本文が送信される場合があります）」); when chosen, the privacy line is replaced by a warning;
- no `fetch`/XHR/beacon/WebSocket/audio-upload/URL exists in the read-aloud code (source-scanned by test) and the real-browser run shows no manuscript-carrying request.

### Lifecycle / overlap
Every start/stop/speed/voice change bumps a run id; `end`/`error` events produced by `cancel()` for the old utterance are ignored, and every `speak()` is preceded by `cancel()`+`resume()`. Speech is cancelled on unmount, project switch, page hide/reload. Nothing calls `start()` except the four press handlers.

## 3. Review Hub registration & pin regression (B2 contract with the first 3-tool state)
- `REVIEW_HUB_TOOLS` = 文章チェックβ, 文字数カウント, **音読β** (registry order = Hub order). Pin ids derive from the same list (test asserts equality).
- Default pins unchanged (`writing-check`, `character-count`); 音読β is **not** pinned by default. Storage key/format unchanged (`tatespun.reviewHub.footerTools.v1`), so B2/B3-era values remain valid.
- Max 2 enforced (model `toggleReviewHubFooterTool` refuses a 3rd; UI disables the toggle of the unpinned tool while two are shown); unpin frees a slot; new pin appends (order = display order, footer row renders in pin order); zero pins valid; unknown ids/dupes/excess stripped on read; persistence across reload verified in Chrome.
- pinned ≠ enabled: unpinned 音読β works from the Hub (E2E).
- Footer compact representation: `▶ 音読` (selection, else caret paragraph) → while reading `⏸/▶` + `■` + `n/N`; also in the mobile one-line footer when pinned.
- B3: Q2 of the 見直し survey is registry-driven, so 音読β appears automatically (test updated).

## 4. Automated QA

| Suite | Result |
|---|---|
| `src/lib/readAloud.test.ts` | 15 pass — notation-free speech text, ranges, chunking, speed, voice privacy rules |
| `src/lib/readAloudEngine.test.ts` | 28 pass — play/next/finish, pause/resume/stop, stale events, no-overlap, speed (playing/paused), voices (`voiceschanged`, timeout, no-voice, explicit online), unsupported, dispose, **no-network source scan** |
| `src/components/readAloudControls.test.tsx` | 15 pass — states, unsupported/no-voice, selector/optgroup, online warning, footer control, registry + EditorPane wiring |
| `src/lib/reviewHubFooterPins.test.ts` | 7 pass — 3 tools + max-2, unpin/pin order, zero pins, normalisation/round-trip |
| existing tests adapted for the 3-tool registry | `reviewHub.test.tsx`, `reviewHubFeedback.test.ts`, `reviewHubFeedbackTab.test.tsx` (unreleased-copy guards now exclude 音読β only; 描写/修飾/傍点/VOICEVOX still forbidden) |
| full `src/lib` / `src/components` / `src/hooks` configs | 440+1 / 162 / 22 — the only failure is the known baseline `exportCancellation` topmost-Escape |
| `tests/e2e/readAloud.e2e.mjs` (real Chrome, fake speech engine, 390/770/1280) | **PASS** — see §5 |
| `tests/e2e/reviewHub.e2e.mjs` (B1/B2, 320…1280 + collapsed + focus + pins) | **PASS** (after the contract adjustment in §6) |
| ESLint on touched files | clean except the known baseline `EditorPane` exhaustive-deps warning |
| `tsc --noEmit` | clean except the pre-existing `layout.tsx` `LayoutProps` (needs `next typegen`) |

## 5. Real-browser evidence (`tests/e2e/readAloud.e2e.mjs`, screenshots in `evidence/`)
Speech is replaced by a deterministic in-page fake so every claim is asserted on what reached the API:
idle/open/close speak nothing · selection reads only the selection (empty selection → guidance, nothing spoken) · caret paragraph and ruby paragraph (`｜宇宙《そら》` → 「そら」, no `｜《》` ever spoken) · full manuscript in order · progress `1 / 6 文` · pause freezes (nothing advances 900 ms), resume continues, stop → synth clean, silence · speed 1.5 reaches the utterance; changing to 0.8 mid-reading restarts the sentence at 0.8; speed remembered · 4 rapid starts → max 1 active utterance · voice selector (on-device default, online grouped/warned, explicit online honoured, back to auto) · unsupported browser + "no on-device Japanese voice" (online-only device) disable reading with guidance · reload cancels speech (pagehide) and does not auto-read · pins: default-unstored, 3rd pin disabled, unpin frees, pin persists `["writing-check","read-aloud"]`, reload keeps it, footer control reads selection/paragraph, pause/resume/stop from the footer, zero pins · **no request carried the manuscript sentinel and no non-loopback non-GET request occurred in the whole run** · no horizontal scroll, panel and footer controls inside the viewport at 390/770/1280.
Screenshots: `evidence/b4-hub-reading-{390x844,770x720,1280x720}.png`, `b4-footer-reading-*.png`, `b4-unsupported-*.png`.

## 6. Change to a B1 E2E contract (recorded, not hidden) — **PENDING HUMAN ACCEPTANCE**
`reviewHub.e2e.mjs` asserted the panel "shows all content without internal scrolling". That held for two one-line tools; with a third tool that has real controls the content (~417 px at 320 px wide) exceeds the B1 22 rem cap (352 px, unchanged). The panel already documents "longer content scrolls inside the panel", so the assertion became **reachability**: any overflow must scroll inside the panel (`overflow-y:auto`) and every control must scroll into view and be hit-testable. Also, on a 320×568 phone the taller panel can cover the whole Editor pane (the documented short-screen case), so the outside-press check falls back to the page chrome above it. Panel constants/geometry code are untouched.

## 7. Known limits (beta)
- **The voice you get is the device's.** Desktop Chrome/Edge on Windows often expose only *online* Japanese voices; by design those are not used automatically, so 音読β may show "この端末に日本語の音声が見つかりません" until the writer installs an on-device Japanese voice (Windows: 設定 › 時刻と言語 › 音声) or explicitly picks an online voice. Safari/macOS/iOS and Android generally have local voices. **Human QA must record what each device does.**
- Sentence-level highlighting/following in the editor is not implemented (not in the contract).
- Speed/voice changes restart the current sentence (Web Speech cannot change rate mid-utterance).
- Some mobile browsers (notably Android Chrome) implement `pause()` as cancel; resume then re-speaks the sentence. Not testable headlessly.
- Reading is a snapshot: edits made while reading are not spoken (the next start uses the current text).
- With three tools the Hub panel scrolls inside its unchanged cap; on the smallest phones 音読β sits below the fold.
- Quotation / bracket-only fragments are chunked as their own sentence (natural pause) — a rhythm reviewer may want to judge this in Human QA.

## 8. Rollback
Revert the B4 checkpoint commit; no data, storage migration, backend or env is involved. A stored pin list containing `"read-aloud"` is dropped by the older normaliser without error.


## 9. Revision 2 (Human QA round 1 = CHANGES REQUESTED, 2026-09-22)
Root cause of the report: the held selection existed only inside the textarea (the browser keeps `selectionStart/End` after blur but stops painting it), and the footer offered no way to see or change the target.
- **Review Dock card** (`ReadAloudDockCard`): title + status, **音読範囲 radiogroup [選択範囲][現在の段落][全文]**, play / pause / resume / stop on one row, ONE information line (held selection / needs-selection / hint / unavailable / notice / error), speed shown read-only (changed in 見直し). The old status-row control remains only in the mobile collapsed one-line footer and now follows the chosen target.
- **Held selection** (`readAloudHeldSelection.ts`, EditorPane): captured on select / click / keyup and at the first pointer contact with the footer or Hub; validity is **derived** (same document key + the same text at the same place), so an edit, a document switch or a collapsed selection removes it without any effect-driven state; whitespace-only / collapsed selections are never held. UI says 「選択範囲を保持中（N文字）」 only while valid, otherwise 「本文の読みたい文字を選ぶと、選択範囲を読めます。」 and play is disabled.
- **Ghost highlight**: the existing mirror overlay (variant `held`, `.tsp-held-selection`, light blue, pointer-events none) on both editor surfaces, drawn only while 選択範囲 is the target; layered under 文章チェックβ and B5 markers; never in Preview/exports (source-tested).
- **Lifecycle** (unit + browser tested): create → open Hub / click footer / start reading / switch target: unchanged; edit → dropped; click that collapses the selection → dropped; document switch / unmount → dropped (validity derived from `memoStorageKey`).
- **B1 contract** (pending Human acceptance, NOT redefined): the relaxation of "Review Hub panel needs no internal scrolling" to "every control reachable" from §6 stays documented as **PENDING HUMAN ACCEPTANCE**. The footer Review Dock cards do not scroll internally for ordinary controls.
- Status unchanged: IMPLEMENTED / AUTOMATED QA PASS / HUMAN_GATE / NOT RELEASED.
