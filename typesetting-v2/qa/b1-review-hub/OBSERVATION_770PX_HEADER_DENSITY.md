# Observation — header density at ~770px (separate responsive-density polish item)

**Status: `OBSERVATION / PRE-EXISTING / NOT A B1 DEFECT / NOT SCHEDULED`.** Raised during B1 Human QA (2026-09-21). No header code was changed for it; B1 must not redesign the header. Kept here only so the note is not lost. It needs its own decision and its own loop.

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
