# CST-PORT-005: プレビューの「1P / 見開き」切り替え(COLUMNSTAND → TateSpun)

移植ロードマップの候補1。COLUMNSTAND のプレビュー(`PreviewStage` の 1P / 見開き)にならい、TateSpun のプレビューに表示の切り替えを付けた。

## 動き
- プレビュー上部(ズームの右、ページ番号の左)に「1P」「見開き」の2つのボタン。選ばれている方が濃い色。
- 1P: 1ページずつ縦に並べ、中央に置く。見開き: これまでどおり(1ページ目は単独で左、以降 2-3、4-5 … を右綴じで並べる)。
- 切り替えても、ページ番号欄に出ているページが画面の中央に残る(光らせない)。
- 「前」「次」は 1P では1ページずつ、見開きでは見開き単位(CST-PORT-003 のまま)。
- 選んだ表示はこの端末のブラウザに保存(`localStorage` の `tatespun_preview_page_layout`)。原稿データ・クラウドには保存しない。初めては見開き。
- スマホ幅は 1P にするとページが画面幅いっぱいになる(見開き2ページ分の幅で縮めない)。
- 表示だけの切り替え。ページ割り・ノンブル・書き出し(PDF / JPG)は変わらない。

## ファイル
- `src/hooks/usePreviewPageLayout.ts` 保存付きの状態(`useSyncExternalStore`、他の表示設定と同じ形)
- `src/lib/pageJump.ts` `parsePreviewPageLayout`(保存値の読み取り。"single" 以外は見開き)、テストは `src/lib/pageJump.test.ts`
- `src/components/PreviewPane.tsx` ボタン、行の組み方(`previewNavigationGroups(n, pageLayout)`)、切り替え時の位置保持、1P の空き枠なし・中央寄せ・仮置きの幅
