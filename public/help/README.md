# public/help — ヘルプ用アセット置き場

このフォルダは、ヘルプ／本棚の案内で使う画像・アニメーションを置く場所です。
参照は必ず root-absolute（`/help/<file>`）で書き、basePath は参照側で付与します
（`src/app/page.tsx` は `withBasePath()`、`public/docs/help.md` は HelpModal の
`img` コンポーネントが付与）。`/tatespun` を二重に付けないこと。

## backup-caroad.png — 受領済み・稼働中（TSP-LOOP-021 §6）

- 1036×816、8bit RGBA（透過）、約154KB
- 表示: 本棚下部「大切な原稿は、ときどきバックアップを」カード（`src/app/page.tsx`）と
  ヘルプ「大切な原稿は、ときどきバックアップを」節（`public/docs/help.md`）
- 差し替え時はこのファイルを置き換えるだけでよい（参照は1経路に統一済み）

## preview-drag.gif — 受領・最適化済み・稼働中（TSP-LOOP-021 §6）

- 受領元ファイル: 1358×972 / 194フレーム / 約19.9MB（アスペクト比 ≈ 1.397）
- 配信用に ffmpeg（palettegen/paletteuse + hqdn3d + fps 間引き）で最適化:
  **720×516 / 109フレーム / 約7fps / ループ（loop=0）/ 約2.81MB**
  （アスペクト比 ≈ 1.396 で元の比率を維持、約86%削減）
- 表示: ヘルプ「プレビューを移動する」節（`public/docs/help.md`）。
  HelpModal の `img` コンポーネントがファイル名で判定し、ヘルプ本文の幅いっぱい
  （`width:100%` / `height:auto`）で表示する。他の小さな挿絵は最大220pxのまま。
- 差し替え時は同じ比率・ループ・3MB以下を保ってこのファイルを置き換える。
  内容が現行UIより古くなった場合（撮り直し）は再最適化してから差し替えること。
