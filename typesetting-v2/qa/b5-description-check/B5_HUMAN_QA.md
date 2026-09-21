# B5 描写語・修飾表現チェックβ Human QA checklist

Automated coverage proves mechanics and a corpus (`B5_IMPLEMENTATION_RESULT.md` §4–§7). Only a human can judge **whether the candidates are useful on real prose** and **whether the tool feels like help rather than judgement**. The combined sheet is `../b4-b6-train/HUMAN_QA_B4_B6_JA.md`.

Please use 1–2 pieces of your own real manuscript (ideally including some that you consider well-described and some that you consider too explanatory), plus the ~1000-character standard QA story.

## A. Default and enabling
- [ ] After opening the Editor the tool is **OFF**: no yellow anywhere. 見直し → 描写語・修飾表現チェックβ shows "OFFのあいだは何も解析しません".
- [ ] Turn it ON: yellow appears, the mode is **A** only, and the wording explains that A/B/C are breadth, not quality.
- [ ] Turning it OFF removes all yellow at once. Reload: ON/OFF and the chosen breadth are remembered (this browser only).

## B. A / A+B / A+B+C
- [ ] **A**: the highlighted phrases are direct 形容・状態・様子 (美しい, 静かな, ゆっくりと, ふわふわ…). Count ok?
- [ ] **A+B**: adds modifiers such as 泣いている〔少女〕/ 夢のような / 笑いながら. Reasonable, or too noisy?
- [ ] **A+B+C**: adds 時間・場所・用途・識別 (昨日の / 机の上の / 料理用の / 田中さんの). It is meant to be broad; is it useful for structure-watching or just noise?
- [ ] The editor never changes colour by category (one yellow). The category appears only in the detail.

## C. Marker → reason
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

## F. Footer / Hub with four tools (B2 regression)
- [ ] With the default two tools shown, the フッターに表示 buttons of 音読β and 描写語・修飾表現チェックβ are greyed out; unpin one and pin the other. Footer shows `描写・修飾 N件` (or `OFF` when the tool is off) and tapping it opens 見直し.
- [ ] The choice and order survive reload. With none shown, all four tools are still usable from 見直し.
- [ ] 文章チェックβ, 文字数カウント, 音読β still work.

## G. Layout
- [ ] **1280**, **~770**, **390**: nothing overflows sideways; the card fits; the Hub panel scrolls inside itself (the 4th tool is at the bottom — acceptable?).

## H. Privacy
- [ ] The tool never needs a network. (optional, DevTools → Network while it analyses: no request.)

Result: ☐ PASS ☐ FIX NEEDED ☐ ACCEPT AS BETA LIMITATION ☐ RECONSIDER ANALYSIS METHOD (17 MB analyzer) — notes:
