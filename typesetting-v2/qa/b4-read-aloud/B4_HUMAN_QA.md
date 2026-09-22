# B4 音読β Human QA checklist (physical / audible / product judgement only)

## Human QA history
| Round | Verdict | Notes |
|---|---|---|
| 1 (2026-09-22) | **CHANGES REQUESTED** | The stored selection was remembered internally but visually looked lost as soon as the Review Hub / footer took focus; the footer only exposed playback, so the reading target could only be changed by reopening 見直し. |
| 2 (this checklist, "Revision 2") | pending | Footer Review Dock card with 音読範囲 [選択範囲][現在の段落][全文]; 「選択範囲を保持中（N文字）」 + ghost highlight; derived (never stale) hold. The retry checklist in easy Japanese is `../b4-b6-train/HUMAN_QA_B4_B6_JA.md` §1 and §3. |

Status: IMPLEMENTED / AUTOMATED QA PASS / HUMAN_GATE / NOT RELEASED (not FIXED).

Automated coverage already proves mechanics with a fake speech engine (see `B4_IMPLEMENTATION_RESULT.md` §5). Only a human can judge **real device voices** and **usefulness**. The combined B4–B6 sheet is `../b4-b6-train/HUMAN_QA_B4_B6_JA.md`; this file is the B4 detail.

Setup: local build (see the combined sheet for the command). Use the ~1000-character standard QA story if available, otherwise any manuscript with several paragraphs, at least one ruby (`｜漢字《かんじ》`) and one 「会話文」.

## A. Where it is
- [ ] `▶ 見直し` → the third tool **音読β** is listed. The top toolbar is still 設定・オプション・メモ・ヘルプ only.
- [ ] Nothing is spoken when the page opens, when you open/close 見直し, or after you type.

## B. Reading (per device — write the device/browser in the notes)
- [ ] **選択範囲を読む**: select one sentence → only that sentence is read. With nothing selected the guidance line appears and nothing is read.
- [ ] **現在の段落を読む**: put the cursor in a paragraph (no selection) → that paragraph is read.
- [ ] **全文を読む**: the whole manuscript is read in order.
- [ ] Ruby is read as its reading (`｜宇宙《そら》` → 「そら」). No `｜` `《` `》` symbols are spoken; 【改ページ】 is not spoken.
- [ ] **一時停止 → 再開** continues (the current sentence may restart on some phones — note it). **停止** stops at once and nothing continues afterwards.
- [ ] **速度**: 0.5 / 1.0 / 2.0 are clearly different; changing it while reading takes effect within about a sentence.
- [ ] Pressing 全文を読む repeatedly never produces two voices at once.
- [ ] If more than one voice exists, the 音声 selector lets you choose; the choice is remembered after reload.

## C. Device voice behaviour (the real unknown)
- [ ] Which voice is used by default? (name / on-device or online) ______
- [ ] If the device has **no on-device Japanese voice**: is the message understandable ("この端末に日本語の音声が見つかりません…")? Nothing is spoken.
- [ ] If an **online** voice exists: it is only under 「オンライン音声（本文が送信される場合があります）」, and choosing it shows the warning. Default reading never uses it.
- [ ] Tested on: ☐ Windows Chrome ☐ Windows Edge ☐ macOS Safari ☐ iPhone ☐ Android ☐ other ______

## D. Privacy understanding
- [ ] The line 「この端末の音声で読みます。原稿を外部へ送りません。」 is visible without scrolling on a phone and you understand it.
- [ ] (optional, DevTools → Network) while reading, no request contains your manuscript text.

## E. Usefulness for rhythm
- [ ] Reading a paragraph aloud reveals something about tempo / 読点 / repetition that you would not see on screen. (yes / a little / no) — comment: ______
- [ ] Sentence-sized pauses feel natural for judging rhythm (or they distort it): ______
- [ ] Missing for real proofreading? (e.g. follow-highlight, reading dictionary, read-from-cursor): ______

## E2. Revision 2 (Review Dock card) — retry items
- [ ] Pin 音読β: a card appears in the Review Dock under the manuscript with **音読範囲 [選択範囲][現在の段落][全文]**; the current target is obvious; switching needs no trip to 見直し.
- [ ] Select text, then touch the footer: the card says **「選択範囲を保持中（N文字）」** and a light blue ghost highlight stays on the text although the editor lost focus. Reading starts from the card and reads only that text.
- [ ] Collapse the selection (click in the text) / edit the manuscript / switch document: the 「保持中」 line disappears and the ghost with it (never a phantom).
- [ ] 選択範囲 with nothing selected: an explanation, play disabled. 現在の段落 / 全文: readable from the card; pause / resume / stop / 「読み上げ中 n / N」 on the card.
- [ ] 390: the card stacks, nothing overflows, buttons are tappable.

## F. Footer and Hub (B2 regression with three tools)
- [ ] 音読β → フッターに表示: `▶ 音読` appears in the footer; reads the selection, or the paragraph if nothing is selected; shows ⏸/■ and `n/N` while reading.
- [ ] With 2 tools already shown, 音読β's フッターに表示 is greyed out; after unpinning one it can be pinned. The choice survives reload.
- [ ] With 音読β **not** shown in the footer it still works from 見直し.
- [ ] 文章チェックβ / 文字数カウント still work; ON/OFF of 文章チェックβ is independent of the pin.

## G. Layout
- [ ] **1280**, **~770** (split screen), **390** (phone): nothing overflows sideways; the Hub panel scrolls inside itself; every button is tappable; the footer stays one tidy row.

Result: ☐ PASS ☐ FIX NEEDED ☐ ACCEPT AS BETA LIMITATION — notes:
