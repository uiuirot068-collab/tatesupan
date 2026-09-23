# B2 Footer 2-tool customization — Implementation Result

Status: FIXED / RELEASE-CANDIDATE READY / NOT RELEASED

Implemented:
- Review Hubから現在実装済みtoolを最大2件までfooter表示
- 対象: 文章チェックβ / 文字数カウント
- 0〜2件
- 2件時の順序変更
- browser/device local preference
- manuscript/cloud/loginから分離
- footer表示とfeature ON/OFFを分離
- canonical visualLengthを文字数表示に再利用

Layout (Review Hub panel):
- `フッターに表示` is an inline control on each tool's title row (+ one short note in the header row), not a separate settings block. A stacked block cost ~170px and pushed the panel past its cap on a 320x568 phone; the inline form adds 0px (panel height = B1: 218px at 320w, 203px at ≥375w).
- With 2 tools shown, one arrow button per tool swaps their order.
- Default (no saved preference) = both shown = the footer exactly as before B2.

Footer display semantics (Human QA fix):
- 文章チェックβ shown = the existing B1 footer strip (checkbox / 確認候補 / ⚙設定 / note) and, on the phone one-line footer, its `チェックβ` checkbox. Not shown = neither exists in the footer (DOM-level, not CSS-hidden). Its ON/OFF (`tatespun_writing_check`) is never touched by pinning, and stays fully usable in the Hub (toggle / 確認候補を見る / 設定). The result-list popover host stays mounted so the Hub can still open it.
- 文字数カウント shown = the unchanged B1 `現在の原稿文字数 N文字` pill; not shown = no pill on the expanded footer.
- With both shown, pin order = top-to-bottom order in the footer (the 文章チェックβ strip vs the status row that holds the count pill); the Hub's arrow button reads ↑/↓.
- While a 直す/まとめて直す one-step 元に戻す window is open, that single button is still offered even if 文章チェックβ is not shown, so an automated manuscript change is never left without an undo.

Title action row at 768–905px (Human QA fix): 元に戻す / やり直す / 改ページ挿入 / 置換 (/ 報告) stay on ONE row. In that range only, undo/redo are icon-only (aria-label + tooltip kept) and paddings/gap are tighter (`md:max-[905px]`); ≥906px and phones are unchanged.

Known limits (for Human QA / later decision):
- The phone one-line (collapsed) footer's `現在N字` count is fixed and does not follow the 文字数カウント pin; only its チェックβ checkbox follows the 文章チェックβ pin.
- 文章チェックβ has no compact chip: its footer representation is the existing strip (a `文章チェック 3件`-style chip is not built).

Not included:
- B3 feedback instrumentation
- B4 音読β
- B5 描写語・修飾表現チェックβ
- B6 傍点
- production Update History JSON
- production release

Human QA is required before FIX.


Human QA: PASS (2026-09-21 JST)
