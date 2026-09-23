# B5 release notes — DRAFT (not released)

## Update History entry (draft; the Human adjusts wording)

- **Suggested category:** new feature (β)
- **見出し:** 「描写語・修飾表現チェックβ」を追加しました
- **本文:** 「見直し」から、形容や様子の説明になっている表現を黄色でお知らせする機能を追加しました（最初はオフです）。良し悪しの判定ではなく、「ここは情景や動作で見せられるかな？」と考えるための目印です。残してよい表現もたくさんあります。原稿は外部に送られず、端末の中だけで調べます。「A」「A+B」「A+B+C」で、拾う範囲を選べます。

> Update-history rule (roadmap B7 / train policy §9): user-visible, so it needs its own entry. Because the analysis is heuristic, say "β" and "目印" and avoid promising completeness.

## Developer notes
- Depends on B1 (Review Hub) and B2 (footer pins); optionally B4 only in that they share the pin registry — no code dependency on B4/B6.
- No dependency added, no backend/schema/env change, no network. Browser-local preference `tatespun.descriptionCheck.v1`. Removal = revert the commit.
- Analysis method is a **beta limitation** (see `B5_IMPLEMENTATION_RESULT.md` §3): heuristic morphology, no POS dictionary; the measured alternative (kuromoji, 17 MB dictionary) is documented for a v1.0 decision.
- Watch after release: reports of misses/false positives (feed them into the corpus table), any report of typing lag on very long manuscripts.

Release-candidate status: NOT READY — Human QA pending (and a Human decision on the analysis-method limitation)
Publication status: NOT RELEASED
