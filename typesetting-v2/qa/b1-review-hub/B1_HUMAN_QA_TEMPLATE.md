# B1 Review Hub / 見直し — Human QA template

Checkpoint: `HUMAN_GATE` (implemented locally, not released). **Do not mark FIX until this sheet is returned.** Nothing here authorises deploy, push or merge; A4 soak is unaffected.

Run the branch `feat/tsp-b1-review-hub-20260921` locally the same way as before (`typesetting-v2/qa/HUMAN_QA_PRE_INTEGRATION.md`). Use the **normal editor** (`/editor`), not the おためしデモ (its STEP card can sit over the footer on a phone). Write anything into a work first (a few paragraphs; one unclosed `「` makes 文章チェックβ show a candidate).

Fill in `PASS` / `FAIL (what you saw)` / `n/a`.

## A. Desktop (about 1280px)
| # | Do | Expect | Result |
|---|---|---|---|
| A1 | Look at the top row | Still exactly **設定・オプション・メモ・ヘルプ** — no 見直し there | |
| A2 | Look at the bottom of the Editor | A small `▶ 見直し` button next to the character count | |
| A3 | Click it | A small panel opens **upward** from the footer; the arrow turns up; heading 見直し; two tools: 文章チェックβ, 文字数カウント. The manuscript text does not jump | |
| A4 | Compare 文字数カウント with the footer pill; type a few characters | Same number; follows what you type | |
| A5 | Toggle 文章チェックβを使う | The footer's own 文章チェックβ checkbox flips with it, and back | |
| A6 | With a candidate present: 確認候補を見る | Panel closes; the usual candidate list opens above the footer | |
| A7 | Open 見直し again → ⚙ 設定 | The usual 文章チェック設定 dialog opens | |
| A8 | Click back into the manuscript while the panel is open; keep typing | Panel closes; **your typing continues in the manuscript** (focus was not taken) | |
| A9 | Open the panel, press **Esc** (also try Tab into it first) | Closes; focus returns to `▶ 見直し` | |
| A10 | Press 集中モード while it is open, then 通常に戻す | The footer and the Hub are hidden in 集中モード and come back **closed** | |
| A11 | Reload | Hub is closed; nothing about it is remembered | |
| A12 | The old routes: the bar's checkbox / candidates / ⚙, the pill, work counter | All still there and unchanged | |

## B. Narrow desktop window (about 770px wide)
| # | Do | Expect | Result |
|---|---|---|---|
| B1 | Open 見直し | The whole panel is visible inside the editor column — **no left edge cut off** | |

## C. Phone (a real phone if you can; otherwise a 390px-wide window)
| # | Do | Expect | Result |
|---|---|---|---|
| C1 | Normal footer: `▶ 見直し` visible; open it | Panel opens above the footer, fully on screen, the top rows (title, undo/redo, 設定…) stay visible and usable | |
| C2 | Fold the footer to the one-line form (▼). Is `▶ 見直し` there? Is the character count still readable (try a long work)? | Trigger present; nothing overflows sideways; count shows fully | |
| C3 | One-line form → open 見直し → 確認候補を見る | Footer expands and the candidate list is shown | |
| C4 | **Real phone only:** tap the manuscript so the keyboard opens | The footer (and the Hub) fold away as before; `書き出し ▾` still reachable; after the keyboard closes the Hub is not open | |
| C5 | 集中モード on the phone and back | As A10 | |
| C6 | Smallest phone you have (320px wide, if any) | Trigger present, no sideways overflow; note whether a long count is cut (decision D1) | |

## D. Judgement calls (tick one each)
- **D1** 320px one-line footer: ☐ accept a 5–6-digit count being clipped by a few px at exactly 320px ☐ change
- **D2** From the one-line footer, `確認候補を見る` / `⚙ 設定` expand the footer (same as its ▲): ☐ accept ☐ Hub should only offer toggle + count there
- **D3** Very short screen (≈568px high) with the expanded footer: the panel rises over the title/undo rows: ☐ accept ☐ require another approach
- **D4** Other existing tools that might belong in 見直し (none were added): ☐ 作業カウンター ☐ 完成前マイチェックリスト ☐ 検索・置換 ☐ 入力記法 help ☐ none for B1
- **D5** Wording (`文章チェックβを使う` / `確認候補を見る` / `現在の原稿文字数`, the two one-line descriptions): ☐ OK ☐ change: ______
- **D6** 文章チェックβ stays default ON: ☐ OK ☐ change
- **D7** Trigger position (right of the status row / before ▲ on the one-line footer): ☐ OK ☐ change: ______
- Is the panel modest enough — an organiser, not a dashboard? ☐ yes ☐ no: ______
- Anything confusing to a first-time user? ______

## E. Verdict
```
B1 Review Hub: PASS | PASS with changes (list) | FAIL        Human / date: ____________
Blocking issues (repro, device, browser): ____________________
```
PASS here means "ready to be scheduled into a release train"; it is **not** a release, and Production PASS is a separate step after deploy. The roadmap stays `HUMAN_GATE` until this is returned.
