# B4 release notes — DRAFT (not released)

## Update History entry (draft; the Human adjusts wording)

- **Suggested category:** new feature
- **見出し:** 「音読β」を追加しました
- **本文:** 「見直し」から、文章を声に出して読み上げて、リズムや読点の位置を耳で確かめられるようになりました。選択範囲・いまの段落・全文を読めます。読み上げにはお使いの端末の音声を使い、原稿は外部に送られません（端末に日本語の音声がない場合は読み上げできません）。

> Update-history rule (roadmap B7): B4 is user-visible, so its release needs its own entry (train policy §9: one entry per B-item).

## Developer notes
- Files: `src/lib/readAloud.ts`, `src/lib/readAloudEngine.ts`, `src/hooks/useReadAloud.ts`, `src/components/ReadAloudControls.tsx`; registration in `reviewHub.ts` / `reviewHubFooterPins.ts` / `ReviewHubFooterPinnedTools.tsx` / `EditorPane.tsx`.
- Depends on B1 (Review Hub) and B2 (footer pins) only — both scheduled earlier. No dependency on B5/B6.
- No backend, schema, env or dependency change; nothing to redeploy except the front end.
- Browser-local preference `tatespun.readAloud.v1` (speed + explicit voice). Removal = revert the commit.
- Behaviour to watch after release: "no on-device Japanese voice" reports (Windows Chrome/Edge), Android pause behaviour.

Release-candidate status: NOT READY — Human QA pending
Publication status: NOT RELEASED
