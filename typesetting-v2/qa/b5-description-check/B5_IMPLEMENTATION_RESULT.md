# B5 描写語・修飾表現チェックβ — implementation result

Status: **IMPLEMENTED / AUTOMATED QA PASS / HUMAN_GATE / NOT RELEASED — with a BETA LIMITATION REVIEW on the analysis method (§3, §7)**. Not FIXED.
Branch `feat/tsp-b4-b6-train-20260922` (after the B4 checkpoint) · push NO · deploy NO · master merge NO · A4 untouched · DB/Auth/Supabase/migrations untouched · **no new dependency, no external AI/API, no manuscript upload.**

## 1. Contract (roadmap B5 / Addenda D, E, G)
Default **OFF**; when enabled, default mode **A** only; modes **A / A+B / A+B+C** (detection breadth, never a quality rank); one yellow family in the editor; category/reason in the detail; explain that keeping the phrase may be right; no generative AI; no upload; do not pretend a tiny phrase list is a structural analysis; Review Hub tool #4; performance safe on long manuscripts.

## 2. What was built

| Piece | File |
|---|---|
| analyzer (pure) | `src/lib/descriptionCheck.ts` — 28 rules over paragraphs; categories/modes/labels/notes |
| manuscript driver | `src/lib/descriptionCheckManuscript.ts` — notation-aware raw-offset mapping (ruby / 縦中横 / 改ページ / 挿絵), per-paragraph LRU cache, time-sliced cancellable async runner, caret lookup |
| painting helpers | `src/lib/descriptionMarkSegments.ts`; `src/components/DescriptionMarkOverlay.tsx` (mirror-behind-textarea highlight, like 文章チェックβ's overlay; one CSS class `.tsp-description-mark`) |
| state | `src/hooks/useDescriptionCheck.ts` — browser-local pref `tatespun.descriptionCheck.v1` `{enabled:false, mode:"A"}`; debounced (450 ms), IME-aware, disabled ⇒ the effect returns before scheduling anything |
| views | `src/components/DescriptionCheckControls.tsx` — Hub section (toggle, A/A+B/A+B+C radiogroup, count, candidate list with category+reason, caret detail), footer pill (`描写・修飾 N件` / `OFF`), detail card |
| wiring | `EditorPane.tsx` (both surfaces), `PagedEditor.tsx` (`descriptionMarks` prop → page-local marks for the WINDOWED editor), registry (`reviewHub.ts`), pins (`reviewHubFooterPins.ts`), `ReviewHubFooterPinnedTools.tsx`, `globals.css` |
| corpus | `B5_SPEC_REGRESSION_CORPUS.md` (the table is the test data; `descriptionCheckCorpus.ts` reads it) |

UI behaviour: OFF ⇒ no overlay is even mounted, nothing stored, nothing analysed. ON ⇒ mode A. The three breadths are a radiogroup; the Hub always says "A・B・Cは文章の良し悪しではなく、拾う範囲の広さです。黄色の箇所は「見直し候補」です。残してよい表現もあります。" Clicking a highlighted phrase shows a card: `B｜連体修飾候補 「泣いている」 動詞などで名詞を詳しく説明する修飾です… 必要であればそのまま残してください。情景・動作・感覚・たとえで見せる余地がないか、確かめるためのチェックです。` (dismissible; hidden while the Hub is open, in 集中モード and with the mobile keyboard). The candidate list (first 40 of N) jumps to each phrase. Nothing tells the writer to delete or fix (source-scanned).

## 3. Analysis method — BETA LIMITATION REVIEW (the honest part)

**Investigation (bounded):**
- *Intl.Segmenter('ja')* (browser-native, zero bundle): segments words but has no POS and splits inflections inconsistently (`美しい|花` but `美|しく`, `青|か|っ|た`), so it cannot drive adjective detection.
- *A real morphological analyzer* (kuromoji/IPADIC), measured in an isolated scratch install (`evidence/kuromoji-alternative-measurement.json`): correct POS on every spot sentence (形容詞 / 形容動詞語幹 / 副詞 / 連体化…) **but a 17.0 MB dictionary** (12 files, runtime same-origin download + JS gunzip), +318 MB RSS / 83 MB heap after load (Node; a lower bound for phones), ~300 KB JS, ~0.4 s per 100k characters. Adding it also means a build/deploy change (copying the dictionary into the static export) and a runtime dictionary download, which the brief says not to rely on.
- *Chosen:* the smallest honest approach — **productive-morphology rules + small closed-class tables + phrase-span heuristics**, entirely local, ~26 KB of source, no dependency. Its structure is described in the header of `descriptionCheck.ts`: (1) productive patterns that fire on **unseen** words (`…しい`, `…げ/…しそう`, `…的な`, `…っぽい/…ったるい`, `…だらけ`, `…やかな`, generic `漢語+な+名詞`, reduplicated / `…っと` / `…んと` / `…んやり` mimetics, `…のよい`); (2) closed vocabulary tables (218 i-adjectives, 116 形容動詞 stems, 45 degree adverbs, place / person / time heads) that fire in **any** sentence; (3) verb-連体形+noun, `…のような`, `…ながら`, `名詞+の+名詞` structure rules and a clause-boundary heuristic for the phrase span.

**Why this is a BETA LIMITATION and not a "structural analysis FIXED":** there is **no POS disambiguation**. Words outside the tables and outside the productive patterns are missed (e.g. 無愛想な・真剣な were only caught after adding the generic `漢語+な+名詞` rule; 「差し込む」 style dictionary-form relative clauses are not caught); homographs can be over-picked; the A/B boundary for compound verbs is fuzzy. It is a candidate finder, not a parser. The roadmap's "structure / token / POS / modifier relation" target is met **in part** (modifier *structure* yes; token-level *POS* no). Human QA on real manuscripts decides whether this precision is acceptable for the beta, or whether the 17 MB analyzer should be reconsidered as a v1.0 (lazy-loaded, desktop-first) option.

## 4. Corpus and measured accuracy (honest numbers)
`B5_SPEC_REGRESSION_CORPUS.md`: **A / B / C / 対象外 / 迷う** rows in three sets. The development set D was written while building the rules (so it is not blind). The two unseen sets U and V were written *before* the analyzer was run on them; their first-run numbers are recorded here exactly as they came out:

| Set | Rows judged | First run (blind) | After generalising the failures | Known misses (tagged, not hidden) |
|---|---|---|---|---|
| D (development; tuned while writing rules) | 27 | 27/27 (not blind) | 27/27 | 0 |
| U (unseen #1, 39 judged) | 39 | **29/39 = 74 %** | 37/39 | 2 (U-16 A/B boundary, U-25 dictionary-form 連体節) |
| V (unseen #2, written after U's fixes, 38 judged) | 38 | **30/38 = 79 %** | 37/38 | 1 (V-28 dictionary-form 連体節) |

Reading the table honestly: the second column is the best estimate of behaviour on *new* sentences **written by the same author who knows the rules** — real manuscripts will do worse. The failures of the blind runs were structural gaps (the `て`-row of the 〜た rule, hearsay 「らしい」 misread as 〜しい, 「〜げ」 with a し, generic 漢語+な, 〜かけの, 〜んと mimetics, 述語形 〜だった of 形容動詞) and were fixed by generalising the rule — **not** by adding the failing sentence as a phrase. Extra sentences that appear in no table (痛々しい, 堅苦しい, 妖しげな, ざらざらと, ぱらぱらと, 印象的な, 素朴な, 殺風景な, 華々しい) are asserted in `descriptionCheck.test.ts`.
`迷う` rows are only observed (5 today). **The Human's real-manuscript A/B/C/対象外/迷う judgements should be appended to the same table** (format described in the file); the test then follows automatically.

## 5. Performance (long manuscripts)
Node (`evidence/long-manuscript-perf-node.json`): 300k characters cold **227 ms**, cached re-run 5 ms, one-paragraph edit 6.5 ms; async runner slices ≤ ~8.6 ms.
Real Chrome, WINDOWED editor, 1280×720, 102,000 characters / 1,500 paragraphs (`evidence/long-manuscript-perf-browser*.json`, 3 runs):
- analysis completes in the background in **0.6–0.9 s**; 4,501 candidates in mode A, 12,002 in A+B+C;
- keystroke→paint median **ON 78–84 ms vs OFF 111–118 ms** (no slowdown; noise dominates);
- worst main-thread long task **ON 324–346 ms vs OFF 337–339 ms** — i.e. the existing paged-editor cost on a 100k manuscript, *not* added by B5; long tasks during the one-off analysis: 53–265 ms.
- Disabled ⇒ nothing runs (source-tested, and OFF long-task baseline measured above).

## 6. Review Hub, 4 tools and the B2 max-2 rule (real Chrome, 390 / 770 / 1280)
Registry order: 文章チェックβ, 文字数カウント, 音読β, **描写語・修飾表現チェックβ**. Verified in the browser: default pins unchanged (unstored); with 4 tools the other two toggles are disabled; unpin frees a slot; pin appends (`["writing-check","description-check"]`); reorder → `["description-check","writing-check"]`; persistence across reload; any 2 of 4 shown (`["writing-check","read-aloud"]`); zero pins valid and all four tools stay listed and usable; pinned pill reads `描写・修飾 OFF` while the tool is OFF (display ≠ enable), then `描写・修飾 N件` == the Hub count; tapping the pill opens the Hub; the tool works while unpinned. B3's 見直し-survey Q2 picks the new tool up from the registry automatically.

## 7. Automated QA
| Suite | Result |
|---|---|
| `descriptionCheck.test.ts` (corpus rows as individual tests + mode contract + unseen words + FP guard + framing + privacy) | 122 pass |
| `descriptionCheckManuscript.test.ts` (raw offsets incl. ruby/縦中横/改ページ/挿絵, cache/LRU, async slicing & cancel, perf budgets, caret/painting/page helpers) | 16 pass |
| `descriptionCheckControls.test.tsx` (OFF default, modes, list, detail, pill, one yellow class, registry, both surfaces, gating, debounce) | 15 pass |
| adapted: `reviewHub.test.tsx`, `reviewHubFeedback*.test.*`, `reviewHubFooterPins.test.ts` (4 tools) | pass |
| full `src/lib` / `src/components` / `src/hooks` | 579 (1 known baseline `exportCancellation`) / 177 / 22 |
| `tests/e2e/descriptionCheck.e2e.mjs` (real Chrome, 390/770/1280 + long manuscript) | **PASS** |
| `tests/e2e/reviewHub.e2e.mjs` (B1/B2) and `readAloud.e2e.mjs` (B4) on this build | **PASS** |
| ESLint (touched files) / `tsc` | only the baseline `EditorPane`/`PagedEditor` exhaustive-deps warnings; tsc clean except the pre-existing `LayoutProps` |
The real-browser run also asserts: default OFF (no overlay, no stored key), enable→A only (`静かな`,`まるで`), A+B adds `夢のような…`/`泣いている`, A+B+C adds `昨日の`/`駅前の`, counts strictly increase, **all markers share one computed background `rgba(250,204,21,…)` even with two categories present**, clicking a phrase shows category/reason/keep-note (never delete/fix wording), ON+breadth persist across reload, OFF removes every marker, **no request carried the manuscript sentinel and no non-loopback non-GET request occurred**, no horizontal scroll, panel/card/pill inside the viewport. Screenshots: `evidence/b5-*.png`.

## 8. Known limits (beta)
- Analysis is heuristic (§3): expect misses (unfamiliar adjectives, dictionary-form 連体節) and some over-picks (e.g. 「大変な」「変な」, ambiguous 〜な). C is intentionally broad and dense (a plain `AのB` is a C candidate).
- No POS means the `reason` is about the *pattern found*, not a grammatical proof.
- Analysis re-runs after edits (450 ms debounce); the overlay is hidden while it lags (same rule as 文章チェックβ), so marks flicker off briefly while typing.
- The detail card also appears when the caret merely enters a highlighted phrase while typing; it can be dismissed (✕) — Human QA should judge whether that is intrusive.
- On the very smallest phones the Hub panel scrolls inside its unchanged cap, with the 4th tool at the bottom.
- Dialogue and narration are treated alike (no 地の文/会話 split).
- Analysis is per paragraph (a line): modifier relations across a line break are not seen.

## 9. Rollback
Revert the B5 checkpoint commit. No data/storage migration; `tatespun.descriptionCheck.v1` and a `"description-check"` pin id are ignored/dropped by the older normaliser.


## 10. Revision 2 (Human QA round 1 = CHANGES REQUESTED, 2026-09-22)
- **Old staged mode removed** (`DescriptionMode`, A / A+B / A+B+C, `filterCandidatesByMode`). **New state:** `{ enabled, categories: { A, B, C } }` — independent; a candidate has ONE category and is shown iff `candidate.category ∈ enabled categories`. Zero selected is valid (calm message, no marker, no count, and **no analysis runs**). First enable = A only.
- **Meanings (shown in the Hub and in every tag):** A｜直接的な説明（直接的な説明・状態・評価・様子）, B｜描写的な修飾（描写的な連体・連用の修飾）, C｜広い修飾（時間・場所・用途・識別など）. Not quality, severity, badness or deletion priority; the not-a-judgement note says so and says colour means the kind only.
- **Persistence migration** (`migrateDescriptionPrefs`, same key `tatespun.descriptionCheck.v1`): old `{enabled, mode:"A"|"AB"|"ABC"}` → A / A+B / A+B+C checkboxes on read; the next change writes the new shape (no `mode`); independent states (B only, A+C, none) round-trip; junk never throws. Browser-local only; no cloud.
- **Markers:** three tints of one yellow family (`rgba(250,204,21, .58 / .36 / .20)` for A / B / C; A>B>C where candidates overlap); category also always as text; no traffic-light colours (source-tested). Single click / tap reports the caret (select, click, keyup handlers) → detail; the Hub says 「色の付いた箇所をクリック（タップ）すると、候補になった理由を確認できます。」
- **Pinned card** (`DescriptionCheckDockCard`): ON/OFF switch, [A][B][C] quick toggles (aria-pressed), count, **前へ / 次へ** over the visible candidates (wrapping; `descriptionCandidateNav.ts`), current phrase + text tag, **理由を見る**; the caret's candidate wins, else the last one navigated to; on a phone the editor is blurred after navigating and a light-blue ghost keeps the place. The Hub keeps settings, explanations and the full list.
- Status unchanged: IMPLEMENTED / AUTOMATED QA PASS / HUMAN_GATE / NOT RELEASED, still with the BETA LIMITATION REVIEW (heuristic analysis).
