# B1 Review Hub — release-note DRAFT (not applied)

**`public/data/tatespun-update-history.json` was NOT edited.** The actual release date may slide, and A4 soak forbids a product change; this file only holds the copy. Nothing here is published.

## Draft entry (same shape as the existing entries)

```json
{
  "date": "26/MM/DD",
  "title": "エディターの下に「見直し」ボタンを追加しました",
  "detail": "エディター画面の下にある「▶ 見直し」を押すと、文章チェックβのオン・オフや確認候補の表示、現在の原稿文字数を、ひとつの場所で確認できます。これまでの文章チェックβや文字数の表示も、そのまま使えます。集中モード中は、画面下の他の表示と同じように隠れます。",
  "type": "improvement"
}
```

- `date`: placeholder `26/MM/DD` — set the real release date (`YY/MM/DD`, as in the file) at release time.
- `type`: `improvement` (the only value in use today).
- Copy rules used: plain language, says what the user can do, mentions that the old places still work, no internal names (`Review Hub`, B1…), no promise about future tools.

## Before applying at release (checklist)
1. Insert the entry **at the top** of the array (newest first) and keep the file valid JSON, UTF-8, LF, no BOM.
2. Only after **A4 Day7** and an explicit release authorisation; it is part of a product release (the file is served from `public/`).
3. **The file's SHA-256 changes** (currently `4d38ac765c958ccb6f53a8b4cd7873482c5cf8165edb303f1f0fbc17987db6fc`, the frozen-RC value). The A4 observers pin that value — `typesetting-v2/qa/beta-prep/a4-readonly-observer.ps1` and `A4_OBSERVATION_TEMPLATE.md` §2.1 (`TATESPUN_RC_EXPECTED_HISTORY_SHA256`); note those files currently exist only on the local branch `claude/tsp-resume-after-loop2`, not on this branch or `master`. Update the pin as part of that release, otherwise the soak/post-release observers will (correctly) report a difference. If A4 is already closed by then, retire or re-pin the frozen-RC identity probe deliberately.
4. Re-read the wording against what shipped (e.g. if D2/D4/D5 in `B1_HUMAN_QA_TEMPLATE.md` changed the panel, change this copy too).
5. Show it in the Human QA of the release like the previous entries (Update History accordion).
