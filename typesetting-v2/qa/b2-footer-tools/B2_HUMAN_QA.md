# B2 Footer 2-tool customization — Human QA

Status before Human QA: HUMAN_GATE / IMPLEMENTED — NOT RELEASED

## Selection
- `▶ 見直し` 内に `フッターに表示` がある。
- 対象は `文章チェックβ` / `文字数カウント` の2つだけ。
- 0件 / 1件 / 2件の表示を選べる。
- 2件表示時に左右の順番を入れ替えられる。
- 非表示にしてもReview Hubから各toolを利用できる。
- 文章チェックβのON/OFFとfooter表示が別である。

## Persistence
- F5後も表示状態・順番が維持される。
- 別作品へ移動しても維持される。
- 新規作品でも維持される。
- login/cloud saveなしでも維持される。

## Layout
- 1280pxで自然。
- 約770pxでfooterが2段化して本文高さを大きく失わない。
- 390pxで横切れ・致命的圧迫がない。
- B1 Review Hub開閉が正常。
- Focus Mode既存挙動が正常。

## Result
Selection / reorder: PASS / FAIL
Persistence: PASS / FAIL
Semantic separation: PASS / FAIL
1280px: PASS / FAIL
770px: PASS / FAIL
390px: PASS / FAIL
B1 regression: PASS / FAIL

B2 Human QA: PASS / FAIL
