# Observation — header density at ~770px (separate responsive-density polish item)

**Status: `PRE-EXISTING / NOT A B1 DEFECT` — polished in a separate commit (`fix(responsive): compact TateSpun header at tablet widths`), `HUMAN_RECHECK`.** Raised during B1 Human QA (2026-09-21). The B1 commits do not touch the header; the fix below is its own commit and does not change any B1 behaviour.

## What the tester saw
At about 770px wide, the large header block above the Editor feels visually dominant and squeezes the actual Editor/Preview workspace. The Review Hub itself was not clipped and the top toolbar behaved correctly.

## Measurement (base `6dc820e`, local dev server, headless Chrome, `mobile: false`, 770px wide)
Two blocks sit above the manuscript, both present on the base and unchanged by B1:

| Block | Height @770 | Notes |
|---|---|---|
| App-shell `<header>` (title row `← 作品一覧 / TateSpun β版 / 下書き保存済` + action row `画面モード / 集中モード / クラウドに保存 / 作品一覧 / ログイン・会員登録`) | **146px** (top 32px) | Same value on base and B1 at every width tried |
| Editor pane header (title input, undo/redo grid, 設定・オプション・メモ・ヘルプ row) | **166px** at 768–850px, **132px** at ≥ 900px | The 34px step is that toolbar wrapping to a second line in the ~335–375px Editor column |

At 770px the layout is the two-column (Editor | Preview) split, so the Editor column is only ~335px wide.

| Viewport (base) | Manuscript textarea | Share of viewport height |
|---|---|---|
| 770 × 900 | 332px | 37% |
| 770 × 720 | 152px | 21% |
| 770 × 600 | **32px** | 5% |

So on a ~720px-high window the manuscript gets about a fifth of the screen and on a ~600px-high window it is a sliver. This is the pre-existing density problem; it is independent of the Review Hub.

## Relation to B1
B1 initially made it slightly worse at 768–~905px by adding a footer line (see `B1_IMPLEMENTATION_RESULT.md` §8) — that part was fixed inside B1 and the textarea heights are again identical to base. What remains is the base behaviour above.

## If it is ever picked up (not part of B1)
Candidates, none evaluated: a compact app-shell header below a height/width threshold (e.g. hide the action row's secondary items behind a menu, or drop the subtitle), letting the Editor pane's own toolbar stay one line at 768–900px, or collapsing the shell header while the manuscript is focused. Any of these changes shipped chrome and needs its own Human QA and release note.

## Resolution (2026-09-21, separate polish commit — HUMAN_RECHECK)

**Cause.** In the editor variant of `Header.tsx` the controls block (画面モード + 集中モード + クラウドに保存 + 保存作品一覧 + ログイン / 会員登録) needs 653.7px, but at 768–799px only ~630–632px is free next to the brand block, so its last button wrapped onto a second row (controls 32 → 72px, header 146px). From 800px it fits, but the shell's own padding/gaps still leave 106px until the whole thing goes to one line at ≥ ~1200px (66px).

**Change (editor variant only, width 768–904px = `md:max-[905px]:`).** Controls block: column gap 16 → 12px and row gap 8 → 4px; 集中モード / クラウドに保存 / 保存作品一覧 / ログアウト horizontal padding trimmed to `px-2.5`, ログイン / 会員登録 `px-4` → `px-3`. Shell: `my-2` → `my-1`, `py-2.5` → `py-1.5`, `gap-y-2` → `gap-y-1`. **Nothing hidden, renamed or reordered; button heights (tap targets) unchanged.** The home header, phones (< 768px) and ≥ 905px are unchanged.

| Viewport | Header before → after | Manuscript textarea before → after |
|---|---|---|
| 768×720 / 770×720 | 146 → **94px** | 152.5 → **212.5px** (+39%) |
| 800×720 / 850×720 | 106 → **94px** | 205.9 → **225.9px** |
| 900×720 | 106 → **94px** | 239.9 → **259.9px** |
| 906×720, 1024×768, 1280×720 | 106, 106, 66 (unchanged) | 239.9, 287.9, 279.9 (unchanged) |
| 390×844 | 42.5 (unchanged) | 442 (unchanged) |

Guards: `src/components/headerTabletCompact.test.ts` (source contract) and `tests/e2e/headerTabletDensity.e2e.mjs` (`npm run test:e2e:header-density`). Not verifiable locally: the logged-in state (a long e-mail address next to ログアウト may still wrap at 768–800px, exactly as before).
