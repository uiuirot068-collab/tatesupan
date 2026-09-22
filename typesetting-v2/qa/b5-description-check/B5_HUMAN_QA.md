# B5 描写語・修飾表現チェックβ Human QA checklist

## Human QA history
| Round | Verdict | Notes |
|---|---|---|
| 1 (2026-09-22) | **CHANGES REQUESTED** | A / A+B / A+B+C was not understandable or flexible enough; categories could not be told apart by colour; the pinned footer showed only a count pill; it was not obvious that a marker can be clicked; the Review tools felt cramped against the manuscript. |
| 2 (this checklist, "Revision 2") | pending | Independent A / B / C checkboxes (first enable = A only, zero allowed); three tints of one yellow family + text tags; single click / tap opens the reason; pinned = Review Dock card with ON/OFF, A/B/C, count, 前へ/次へ, current candidate, 理由を見る. Easy-Japanese retry list: `../b4-b6-train/HUMAN_QA_B4_B6_JA.md` §2 and §3. |

Status: IMPLEMENTED / AUTOMATED QA PASS / HUMAN_GATE / NOT RELEASED (not FIXED) — still carrying the BETA LIMITATION REVIEW on heuristic analysis.

Automated coverage proves mechanics and a corpus (`B5_IMPLEMENTATION_RESULT.md` §4–§7). Only a human can judge **whether the candidates are useful on real prose** and **whether the tool feels like help rather than judgement**. The combined sheet is `../b4-b6-train/HUMAN_QA_B4_B6_JA.md`.

Please use 1–2 pieces of your own real manuscript (ideally including some that you consider well-described and some that you consider too explanatory), plus the ~1000-character standard QA story.

## A. Default and enabling
- [ ] After opening the Editor the tool is **OFF**: no yellow anywhere. 見直し → 描写語・修飾表現チェックβ shows "OFFのあいだは何も解析しません".
- [ ] Turn it ON: yellow appears, the mode is **A** only, and the wording explains that A/B/C are breadth, not quality.
- [ ] Turning it OFF removes all yellow at once. Reload: ON/OFF and the chosen breadth are remembered (this browser only).

## B. Independent categories A / B / C (Revision 2)
- [ ] The Hub shows three checkboxes with one-line meanings: **A 直接的な説明・状態・評価・様子 / B 描写的な連体・連用の修飾 / C 時間・場所・用途・識別など広い修飾**, and says the tool does not judge writing, keeping is fine, colour = kind only.
- [ ] First enable = **A only**. Then try each on its own — A only, **B only**, **C only** — and each pair, all three, and **none** (calm "no kind selected" message, no marker, not an error).
- [ ] The three kinds are tellable apart (A slightly stronger, B standard, C paler yellow) **without** feeling like good / bad / danger. Every candidate view also names the kind in text (A｜直接的な説明 / B｜描写的な修飾 / C｜広い修飾).
- [ ] The chosen kinds survive reload; a previous A / A+B / A+B+C choice from the first build is carried over as the matching checkboxes.

## C. Marker → reason
- [ ] The Hub text says a coloured phrase can be **clicked (tapped)** for the reason; a **single** click / tap works (no double click).
- [ ] Click a yellow phrase: a card shows `A/B/C｜…` , the phrase, **why** it was picked, and that keeping it may be right. Its wording never tells you to delete or fix.
- [ ] The card can be closed (✕). Does it get in the way while typing near a highlight? (fine / a little / too much) ______
- [ ] 見直し → candidate list: rows jump to the phrase.

## D. Real-manuscript accuracy (the important part)
Write a few examples you observe; add them to `B5_SPEC_REGRESSION_CORPUS.md` in the same table (区分 A/B/C/対象外/迷う).
- [ ] **Misses** (a phrase that describes/explains a state but is not highlighted): ______
- [ ] **False positives** (highlighted but not really a description): ______
- [ ] 迷う (you can't decide either): ______
- [ ] Overall in mode A: useful / neutral / annoying. In A+B: ______ In A+B+C: ______
- [ ] Does it feel like a **bad-writing judgement**? (no / slightly / yes — where?) ______
- [ ] Do the reasons make you *think about the scene* (action / sense / metaphor) rather than feel corrected? ______

## E. Long manuscript
- [ ] Paste or open a long manuscript (50k–200k characters). Enabling does not freeze the editor; yellow appears within a second or two. Typing stays smooth with the tool ON. (smooth / slightly slower / laggy)
- [ ] Switching A → A+B+C on the long manuscript stays responsive.

## E2. Pinned footer card (Revision 2)
- [ ] Pin the tool: a card appears in the Review Dock with ON/OFF, **[A][B][C]** quick toggles, 「候補 N件」, **[← 前へ] n / N [次へ →]**, the current phrase with its A/B/C text tag, **[理由を見る]**. No need to open 見直し for daily use; the full list and explanation stay in 見直し.
- [ ] 前へ / 次へ move through the visible candidates only (wrapping) and land on the place in the manuscript (on a phone the editor is blurred so the keyboard does not hide the footer, and a light blue ghost keeps the place visible).
- [ ] While the card is pinned, clicking a coloured phrase shows the same information in the card (no second floating card).

## F. Footer / Hub with four tools (B2 regression)
- [ ] With the default two tools shown, the フッターに表示 buttons of 音読β and 描写語・修飾表現チェックβ are greyed out; unpin one and pin the other. Footer shows `描写・修飾 N件` (or `OFF` when the tool is off) and tapping it opens 見直し.
- [ ] The choice and order survive reload. With none shown, all four tools are still usable from 見直し.
- [ ] 文章チェックβ, 文字数カウント, 音読β still work.

## G. Layout
- [ ] **1280**, **~770**, **390**: nothing overflows sideways; the card fits; the Hub panel scrolls inside itself (the 4th tool is at the bottom — acceptable?).

## H. Privacy
- [ ] The tool never needs a network. (optional, DevTools → Network while it analyses: no request.)

Result: ☐ PASS ☐ FIX NEEDED ☐ ACCEPT AS BETA LIMITATION ☐ RECONSIDER ANALYSIS METHOD (17 MB analyzer) — notes:
