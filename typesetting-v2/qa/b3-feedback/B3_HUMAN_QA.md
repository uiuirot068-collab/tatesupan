# B3 Human QA checklist (visible / product behaviour only)

Automated coverage already proves the mechanics (see `B3_IMPLEMENTATION_RESULT.md` §6). Only the items below need a human.

Setup: a local or preview build with `NEXT_PUBLIC_BETA_FEEDBACK_ENABLED=true` **and the real Supabase / Turnstile env of the canonical project** (the automated run used stubs). Use a throw-away manuscript containing an obvious marker sentence (e.g. 「ここはテスト本文です」) and a marker title.

## A. Entry is understandable and unobtrusive
- [ ] Opening the Editor, using the ▶ 見直し panel, pinning/unpinning, and waiting a while **never** opens a feedback screen by itself.
- [ ] 報告 (yellow button) is the only entry; the top toolbar (設定・オプション・メモ・ヘルプ), the Review Hub panel and the footer look exactly as in B2.
- [ ] 報告 opens on **気になる事** as before; **見直し** is a clearly named third tab; 気になる事 and review still work as before.

## B. The questions are useful and fair
- [ ] Q1 reads `見直しのフッター表示は最大2枠で足りていますか？` with `足りている / もう1枠ほしい / もっとほしい / 常時表示は不要`; nothing is preselected and none looks like the "right" answer.
- [ ] Q2 offers only `文章チェックβ` and `文字数カウント` (no unreleased tool), and refuses a third choice if a third tool ever exists.
- [ ] The line asking you to answer only if you have used 「見直し」 is understandable; sending only the free text (no answers) is possible.
- [ ] The free-text warning (do not paste manuscript text / titles / file names) is visible.

## C. What is sent
- [ ] Before pressing send, 「回答と一緒に送られる情報」 shows the current footer tools (matches the footer), the pin-change count and the Hub-open count. Open the Hub 3×, change a pin once, then check the counts are 3 and 1.
- [ ] Send one answered survey. It arrives at the usual destination — the Discord feedback forum (thread named `気になる事｜…｜【見直しアンケート】…`) and a new row in the Spreadsheet sheet 「気になる事」.
- [ ] The received text is exactly the documented lines (`【見直しアンケート】`, Q1, Q2, フッターに表示中, two counters, 自由記述) plus the usual 使用環境 — **and contains no manuscript sentence, no title, no file name.**
- [ ] After a successful send the answers are cleared and the success message shows; after a forced failure (offline) the answers are kept.

## D. Layout
- [ ] **1280**: modal is compact; tabs on one line; send button visible.
- [ ] **~770** (split-screen): same; nothing overflows.
- [ ] **390** (phone): tabs on one line, options tappable, you can scroll to Q2 and the note, send/Turnstile row stays reachable.
- [ ] (optional) **320**: usable, though the scroll area is short.
- [ ] The Review Hub panel itself has not grown on a phone.

## E. B1 / B2 still fine
- [ ] Hub opens/closes; 文章チェックβ and 文字数カウント work; footer pin/unpin/reorder still works and persists after reload; writing-check ON/OFF is independent of the pin.

Result: ☐ PASS ☐ FIX NEEDED — notes:

## Final Human QA

- B1 production-flag recheck: PASS
- B2 production-flag recheck: PASS
- B3 UI / responsive: PASS
- B3 local feedback harness: PASS
- Production ordinary report -> Discord: PASS
- Production ordinary report -> Spreadsheet「気になる事」: PASS
- Privacy sentinels: PASS (body/title not transmitted)

B3 Human QA: PASS
Human QA completed: 2026-09-21 JST
