# PLT-LOOP-003 メモ・プロット欄

2026-10-03 / TateSpun の ▶メモ を「▶メモ・プロット」にし、プロット帳（spuntales-plot v1）のプロットを原稿の横で見られるようにした。

## できること
- 欄の上で「メモ｜プロット」を切り替え（最後に選んだ方を覚える）。メモの中身・保存場所・編集/確定はそのまま。
- プロットは「ファイルを選ぶ」（.plot.json）か「貼りつけて読み込む」（プロット帳の「プロットをまるごとコピー」）で読み込む。
- カーソルのある `#` / `■` 見出しがプロットの章と合えば、その章を開く（例 `# 第2章　帰郷`、`# 帰郷`）。合わない見出しでは動かず、‹ › で手で選ぶ。手で動かしたあとは「この章に戻る」。
- 章ごとに「この章でやること」と場面（題・進み具合・あらすじ・人物・時と場所・メモ）を表示。

## 安全の決まり
- プロット側は見るだけ。原稿・設定・メモ・クラウド保存には書き込まない（`src/lib/plotPanel.test.ts` で PlotPanelView のソースを確認）。
- プロットは作品ごとに localStorage の別の引き出し `tatespun:plot-panel:v1:<cloud:id|local:docId>` に保存。読み出し時も同じ厳しい読み取りで確かめ直す。
- 形が違うファイルは取り込まない（一部だけ読むことはしない）。5MBまで。置きかえ・外すは確認してから。
- 本番DB・Supabase の変更なし。

## ファイル
- `src/lib/plotPanel.ts` — プロット帳 `src/lib/plotFile.ts` / `plotModel.ts` の読み取り部分の写し＋見出し追従＋保存
- `src/components/PlotPanelView.tsx` — プロット表示
- `src/components/InlineMemoAccordion.tsx` — メモ｜プロット切り替え
- `EditorPane.tsx` / `TategakiEditor.tsx` — ボタン名と見出しの受け渡し（パネルが開いているときだけ見出しを読む）
- 使い方（HOW TO・ガイド本）と更新履歴

## 確認
- `npm test` 41 files / 539 tests pass。`src/lib` 設定のテストは master と同じ既存の失敗のみ。lint は master と同数（新しい指摘なし）。
- 画面: PC 1366 / スマホ 390・360・320 で確認。
