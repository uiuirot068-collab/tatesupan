# CST-PORT-016 長い原稿の速度計測パネル（開発用）

移植ロードマップ 8番（棚卸し B6）。COLUMNSTAND の `?perf=1` 計測パネルを TateSpun に移した。

## 使い方
- エディタの URL に `?perf=1` を付ける（例 `/editor?id=12&perf=1`）。右下に「長文の速度計測（開発用）」が出る。
  付けないときはパネルも計測も動かない（各計測点は真偽1つを見て戻るだけ）。
- 文字数（5万／10万／30万字）・原稿の種類（平文／ルビ・縦中横／改ページ・記号）を選んで「テスト原稿を作る」。
  今の原稿が空でなければ確認が出る。置き換えは1回の編集なので Ctrl+Z（元に戻す）で前の原稿に戻せる。
- 「入力面20回」= 入力欄の編集の道すじ（検索・置換と同じ1文字ずつの編集）で、選んだ位置（冒頭／中央／末尾）に20文字入れて測る。
- 「20回計測」= 本文を直接20回書き換えて測る（COLUMNSTAND と同じ比べ方）。
- 「結果コピー」で JSON（時間・文字数・ページ数・編集面 WINDOWED/FULL のみ。原稿の文章は入れない）。
  DevTools からは `window.__TATESPUN_LONG_PERF__.summary()` / `.samples`。

## 測る項目（ms、回数・平均・p95・最大）
| 項目 | 内部名 | どこで |
|---|---|---|
| 入力→次の描画 | inputToNextFrame | TategakiEditor: 編集面からの本文変更 → 次のフレーム |
| 編集ページ分け | editorPagination | PagedEditor の編集ページ（約5万字ごと）分け直し（WINDOWED のみ） |
| プレビュー組版 | previewCompose | useV2PreviewAdapter: ワーカーに頼んでから返事まで |
| 入力→プレビュー反映 | inputToPreview | 最後の本文変更 → その本文の組版がプレビューに入った次のフレーム（待ち 180ms×2 を含む） |
| 旧方式の組版 | legacyPaginate | PreviewPane の LEGACY 組版（V2 の最初の組版ができるまで・LEGACY 時） |

## COLUMNSTAND との違い
- 長文の扱いが違う（TSP は約5万字ごとの編集ページ、CST は動く窓）ので、CST の windowSwap / canonicalUpdate / historyOperation / proofCatchUp は移さず、TSP の仕組みに合う項目にした。
- `?perfDebug=1`（lib/perfDebug.ts、入力の細かい追跡）はそのまま。別の仕組み。
- テスト原稿は TSP の記法（見出し記法がないので「改ページ・記号」）。

## 確認
- `npm test`（src/lib/longDocumentPerf.test.ts 7件を含む）
- `TATESPUN_E2E_BASE_URL=… npm run test:e2e:long-document-perf-panel`（WINDOWED / FULL どちらのビルドでも合格）
