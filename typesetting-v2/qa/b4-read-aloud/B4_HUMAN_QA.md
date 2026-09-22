# B4 音読β Human QA checklist (physical / audible / product judgement only)

## Human QA history
| Round | Verdict | Notes |
|---|---|---|
| 1 (2026-09-22) | **CHANGES REQUESTED** | The stored selection was remembered internally but visually looked lost as soon as the Review Hub / footer took focus; the footer only exposed playback, so the reading target could only be changed by reopening 見直し. |
| 2 (2026-09-22) | Core: **PASS**. Review Dock: **CHANGES REQUESTED** | Footer target selector + held-selection UX judged correct. But the Review Dock card, permanently mounted under the manuscript, "consumes too much editor height" on desktop and "significantly compresses the editor" on mobile — not acceptable as shipped. |
| 3 (this checklist, "Revision 3") | pending | Desktop: pinned 音読β is now a card in a dedicated **Review Rail** beside the manuscript (width only, never height). Compact/mobile: no permanently-mounted card — a one-line mini control in the footer status row, full controls in a Review Hub **Bottom Sheet**; an actively-playing reading stays controllable from the mini bar even unpinned and even after the sheet closes. New: a browser-local **読み辞書（発音の登録）** — register a corrected reading from a selection; ruby still wins over a registered reading. Retry checklist in easy Japanese: `../b4-b6-train/HUMAN_QA_B4_B6_JA.md` §1 and §3. |

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

## E3. Revision 3 (Review Rail / compact mini bar + Bottom Sheet / pronunciation dictionary) — retry items
- [ ] **Desktop (~1280 and wider)**: pin 音読β. It appears as a card in a **Review Rail** beside the manuscript, not below it. The manuscript's own height is unchanged whether 0, 1 or 2 tools are pinned — only its width narrows a little.
- [ ] **~1180 (just past the Rail threshold) and ~900–1024 (narrower desktop / split screen)**: the Rail does not crush the editor/preview into an unusable sliver; below the Rail's threshold there is no permanently-mounted card at all (see the mobile item below).
- [ ] **Mobile (390) and other narrow widths**: no permanently-mounted card under the manuscript. Instead a compact **one-line mini control** for each pinned tool sits in the footer status row, and the full 音読β card (target, held-selection state, play/pause/resume/stop, speed) opens from **▶ 見直し** as a **Bottom Sheet** (slides up from the bottom, a backdrop behind it, roughly 60–75% of the screen height, scrollable, a clear ✕ close button).
- [ ] Start a reading, then close the Bottom Sheet (✕ or tap the backdrop) while it is still playing: the mini bar still shows pause/resume/stop and controls the reading — closing the sheet never strands an in-progress reading, even if 音読β is unpinned.
- [ ] B5 の前へ／次へ still works from the Rail card (desktop) and from inside the Bottom Sheet (mobile) exactly as before.
- [ ] 見直し (Review Hub) itself reads more comfortably now — better spacing between rows, clearer section headings, not as cramped/flat as last round. Comment if anything still feels tight: ______

## E4. 音読の読み辞書（発音の登録）— new in Revision 3
- [ ] In 見直し → 音読β, select a word or phrase in the manuscript first, then press **「音読の読みを登録」**. A small form appears showing the selected 表記 (read-only) and an empty 読み field.
- [ ] Type a reading in **ひらがな・カタカナ** and press 保存. Try an invalid reading (e.g. Latin letters or kanji) — 保存 stays disabled and a short message explains why.
- [ ] Read the manuscript again ([全文] or [選択範囲]): the word is now spoken using your registered reading instead of its usual reading.
- [ ] Register a reading for a word that **already has ruby** (e.g. `｜人気《にんき》`) using a different reading than the ruby. When read aloud, the **ruby reading wins** (にんき), not your dictionary entry — this is intentional (ruby > dictionary > browser default).
- [ ] Open the registered-readings list (「登録した読み（N件）」): edit a reading and delete an entry; both take effect immediately on the next reading.
- [ ] Reload the page: your registered readings are still there (this is saved only in this browser, not to any account/cloud — the panel says so).
- [ ] The manuscript text itself is never changed by registering a reading (no `｜…《…》` gets inserted; check the text area / export is unaffected).

## F. Footer and Hub (B2 regression with three tools)
- [ ] 音読β → フッターに表示: `▶ 音読` appears in the footer; reads the selection, or the paragraph if nothing is selected; shows ⏸/■ and `n/N` while reading.
- [ ] With 2 tools already shown, 音読β's フッターに表示 is greyed out; after unpinning one it can be pinned. The choice survives reload.
- [ ] With 音読β **not** shown in the footer it still works from 見直し.
- [ ] 文章チェックβ / 文字数カウント still work; ON/OFF of 文章チェックβ is independent of the pin.

## G. Layout
- [ ] **1280**, **~770** (split screen), **390** (phone): nothing overflows sideways; the Hub panel scrolls inside itself; every button is tappable; the footer stays one tidy row.

Result: ☐ PASS ☐ FIX NEEDED ☐ ACCEPT AS BETA LIMITATION — notes:
