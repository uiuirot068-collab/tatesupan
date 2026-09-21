# B2 Footer 2-tool customization — Implementation Result

Status: HUMAN_GATE / IMPLEMENTED — NOT RELEASED

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
- Default (no saved preference) = 文字数カウント only, rendered with the unchanged B1 pill (`title="現在の原稿文字数"`, `現在の原稿文字数 N文字`).

Known limits (for Human QA / later decision):
- The pinned 文章チェックβ footer item is a static label (no count, not tappable). A `文章チェック 3件`-style live representation is not built.
- The mobile one-line (collapsed) footer keeps its own fixed チェックβ checkbox + `現在N字` and does not follow the pins; pins apply to the expanded footer (desktop and mobile).
- With both tools pinned in a ~335px split-screen column the footer controls row may wrap to a second line (opt-in only).

Not included:
- B3 feedback instrumentation
- B4 音読β
- B5 描写語・修飾表現チェックβ
- B6 傍点
- production Update History JSON
- production release

Human QA is required before FIX.
