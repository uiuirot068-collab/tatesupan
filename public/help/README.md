# public/help — ヘルプ用アセット置き場

このフォルダは、ヘルプ／本棚の案内で使う画像・アニメーションを置く場所です。
参照側は `withBasePath("/help/<file>")`（basePath 対応）で解決します。`/tatespun`
などを二重に付けないこと。

## HUMAN ASSET PENDING（TSP-LOOP-021）

以下のアセットは未提供です。無い間は本文（テキスト）だけで案内が成立するよう
実装済みなので、これらが揃うまで他の修正をブロックしません。壊れた `<img>` は
出しません。用意できたらこのフォルダへ置き、下記の差し込み口を有効化します。

### backup-caroad.png  §3「原稿バックアップの注意喚起」

- 透過 PNG、元データ 目安 800×800
- 表示サイズ: デスクトップ 160–200px / モバイル 120–150px
- できれば 500KB 未満
- 差し込み口:
  - `src/app/page.tsx` … `BACKUP_ILLUSTRATION_AVAILABLE` を `true` にする
  - `public/docs/help.md` … 「大切な原稿は、ときどきバックアップを」節のコメント

### preview-drag.gif  §4「プレビューの移動」操作アニメ

- 960×540、4–6 秒、10–15fps、ループ
- できれば 2MB 未満（上限 3MB）
- 差し込み口: `public/docs/help.md`「プレビューを移動する」節のコメント
