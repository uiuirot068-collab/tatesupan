# B4 音読β Human QA checklist (physical / audible / product judgement only)

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

## F. Footer and Hub (B2 regression with three tools)
- [ ] 音読β → フッターに表示: `▶ 音読` appears in the footer; reads the selection, or the paragraph if nothing is selected; shows ⏸/■ and `n/N` while reading.
- [ ] With 2 tools already shown, 音読β's フッターに表示 is greyed out; after unpinning one it can be pinned. The choice survives reload.
- [ ] With 音読β **not** shown in the footer it still works from 見直し.
- [ ] 文章チェックβ / 文字数カウント still work; ON/OFF of 文章チェックβ is independent of the pin.

## G. Layout
- [ ] **1280**, **~770** (split screen), **390** (phone): nothing overflows sideways; the Hub panel scrolls inside itself; every button is tappable; the footer stays one tidy row.

Result: ☐ PASS ☐ FIX NEEDED ☐ ACCEPT AS BETA LIMITATION — notes:
