# CST-PORT-015 検索・置換「置換したら、その場で確かめられる」(2026-10-03)

移植ロードマップ候補7(棚卸し B7「一致箇所の前後表示」)と、なつおの要望(2026-10-03 12:34「置換した瞬間に次の箇所へ移動してしまい、本当に直ったか確認できない」)をまとめた回。TateSpun と COLUMNSTAND の両方。

## 変わったこと
1. 1件だけ置換しても、エディターは次の一致へ移らない。直した文字を選んだまま、その場に止まる(スクロールも編集ページの切り替えもしない)。
2. 直した文字に薄い色を付ける(TateSpun は B4/B5 と同じ青いゴースト、COLUMNSTAND は `sr-tint`)。
3. 検索・置換の窓に「n 件目を置換しました」と、直したところの前後12文字(改行は ↵、直した文字に色)を出す。
4. 「この置換を戻す」で、その1件だけ元に戻す(1回の編集。戻した文字は再び選択中の一致になり、続けて置換できる)。
5. 次へ進むのは「次へ」「前へ」を押したときだけ。次へ = 直した文字の後ろの一致、前へ = 前の一致(折り返しあり、直した文字の中の一致には止まらない)。件数は「残り ○ 件」。
6. 「すべて置換」も窓を閉じず「○ 件を置換しました」を出す(エディターの「元に戻す」1回で全部戻るのは今までどおり)。
7. B7: 検索中の一致箇所の前後表示も同じ形(前後12文字・一致に色・改行 ↵)にそろえた(TateSpun は以前16文字・色なし)。

## 作り
- 共通部品 `src/lib/searchReplaceNavigation.ts`(両リポジトリでバイト一致): `ReplaceReceipt`(直した記録)、`receipt` アクション、`validReceipt`(本文が変わって位置がずれたら消す)、`matchContext`(前後の文字、サロゲートペアを割らない)、`stepFromView`(直した文字を起点に次へ/前へ)、`planUndoReceipt`。
- TateSpun: `SearchReplaceModal` から置換後の自動移動(`pendingAfterReplaceRef` → `onFind`)を削除。`EditorPane.replaceSearchMatch` は挿入した文字を選んだまま(FULL はスクロールなしの `setSelectionRange`、WINDOWED は `replaceRangeGlobal(..., { selectInserted: true })` で文字の最後がある編集ページ・スクロール指示なし)。色は `setSearchMark` → `ghostRanges`。
- COLUMNSTAND: 置換はもともと直した文字を選ぶ作りなので、窓の自動移動だけを削除。色はハイライト層(tone `replaced`)。
- 検証: `npm test`(TateSpun 545件 / COLUMNSTAND 508件)、TateSpun `tests/e2e/searchReplaceNavigation.e2e.mjs` を WINDOWED・FULL の両方で合格(置換前後でスクロール位置が同じ、この置換を戻す、次へ、すべて置換)。COLUMNSTAND は next dev で PC・スマホを確認。

## やっていないこと
- 「置換して次へ」を選べる設定(案の段階で今回は入れないと決めた)。
- 「すべて置換」の直後にエディターが直した場所へ移るのは今までどおり。
