# CST-PORT-003: ページ番号で移動(COLUMNSTAND → TateSpun)

棚卸し B1。COLUMNSTAND の `src/components/PageNumberInput.tsx` をプレビューのページ移動に移植。

## 動き
- プレビュー上部(ズームの右)に「前 [ 15 ] / 20 次」を置く。
- 数字を入れて Enter(またはフィールドの外をタップ)で、そのページへ移動し、ページの枠を一瞬光らせる。
- 全角数字OK。0以下は1ページ目、総ページ数より大きい数は最後のページへ丸める。
- 数字以外(空欄・文字・小数)と Esc は元の番号に戻し、移動しない。
- 日本語入力の確定 Enter では移動しない。
- 「前」「次」は見開き単位で移動し、見開きの先頭ページ(1 → 2 → 4 → 6 …)に止まる。
- スクロールや編集位置の追従でプレビューが動くと、画面中央の見開きのページ番号に表示が追従する。
- スマホ幅ではボタンと入力欄を高さ36pxにする(PCは28px)。

## ページ番号
目次・奥付を含む物理ページ番号(Phase11〜13 の Presentation Sequence、ノンブル・「全 N ページ」と同じ数え方)。

## 1ページ表示・見開き表示
TateSpun のプレビューは現在、見開き表示だけ(1ページ目は単独)。移動の計算(`src/lib/pageJump.ts`)は
`"single"` / `"spread"` の両方に対応しており、テストも両方を確認している。1ページ表示の切り替えを足すときは
`previewNavigationGroups(n, "single")` を渡せばそのまま使える。

## ファイル
- `src/lib/pageJump.ts` 計算(入力の解釈・丸め、ページ→見開き、前/次、スクロール位置→ページ)
- `src/lib/pageJump.test.ts` テスト(`npm test` に追加)
- `src/components/PageNumberInput.tsx` 入力欄と前/次ボタン
- `src/components/PreviewPane.tsx` 組み込み。各ページに `data-preview-physical-page` を付けた
