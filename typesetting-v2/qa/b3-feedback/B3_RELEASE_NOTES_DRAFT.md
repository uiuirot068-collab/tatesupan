# B3 release notes — DRAFT (not released)

## Update History entry (draft; decide with the Review Hub release — do not publish separately)

- **Suggested category:** improvement
- **見出し:** 「見直し」のご意見を送れるようになりました
- **本文:** β版の「報告」に「見直し」タブを追加しました。「見直し」の使い心地や、フッターに表示できる数（現在は最大2つ）について、選択式で気軽にお知らせいただけます。原稿の内容は送信されません。

> Update-history rule (roadmap B7): B3 is user-visible in the beta build, so the release that ships it needs an entry (or an explicit "not needed" decision recorded in that release's result). Wording above is a draft for the Human to adjust.

## Developer notes

- New third tab 「見直し」 in the existing β 報告 modal; answers travel as an ordinary `feedback` report through the existing `beta-feedback` function (Discord forum + 「気になる事」 sheet). No backend, schema, env or Edge Function change — nothing to redeploy for B3.
- Sent: the two answers, the current footer tools, two per-page-load counters (Hub opens, pin changes), the writer's optional note, plus the existing 使用環境 diagnostics. Never sent: manuscript, title, file names, IDs, images.
- Read the results by filtering the 「気になる事」 sheet for `【見直しアンケート】`.
- Removal: revert the B3 commit (no data migration needed).
