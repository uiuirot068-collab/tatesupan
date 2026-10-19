# TSP-PRINT-004 — 挿絵と下の欄を PDF・JPG と同じ描き方に（P4-8）

TSP-PRINT-003（master 63ecf55）の続き。引き継ぎは `/mnt/project-files/TateSpun/tsp-print-003/handoff/HANDOFF_P4-8.md`。

## 先に測ったこと（直す前）

新しい計測の道具 `tests/e2e/illustrationParity.e2e.mjs`（`npm run test:e2e:illustration-parity`）。挿絵だけのページを作って書き出し、プレビューの位置と、PDF（600dpi で画像にした）／JPG のインクの位置を比べる。

| 場面 | 直す前の差 |
|---|---|
| 天・中央・地（1枚・同じ位置に何枚も・大きすぎて縮む・2段組） | 0.08mm 以内（TSP-PHASE13-001 で共通の決め方になっていた） |
| 全面・仕上がりPDF／JPG | 1.2〜1.8mm（PDF は仕上がりだけを覆う大きさ、プレビューと塗り足しPDFは塗り足しまで覆う大きさ。切り取られる所がちがう） |
| 全面・挿絵の縦横比と枠の縦横比がちがう時 | PDF は枠に合わせて引きのばし、プレビューは切り取り（ふつうは同じ比なので起きにくい） |
| Web閲覧用の下の欄 | JPG に下の欄（線・ロゴ・TateSpun・URL・#スパンテイルズ）がまったく入っていなかった |
| Web閲覧用のノンブル | プレビューは左下に固定、JPG は小口側（偶数ページは右下）で別の高さ |
| Web閲覧用・SNS用の柱・ノンブルの大きさ | プレビューが JPG の約1.7倍（プレビューだけ CSS の pt で描いていた）。Web の JPG は設定にかかわらず 15pt/20pt に固定 |
| Web閲覧用・SNS用で左右の余白がちがう時の偶数ページ | プレビューは左右を入れかえ、JPG は入れかえない（挿絵・本文が 6〜44px ずれる） |
| SNS用 4:5 でノンブルを出す時 | ノンブルがクレジットの文字に重なっていた |
| SNS用 4:5 のクレジット | 文字が JPG で 2px 上（Canvas の「middle」で置いていた） |

## 直したこと

| 作業 | 中身 |
|---|---|
| 全面の挿絵 | `fullPageCoverRect`（`src/lib/imageGeometry.ts`）1つで、プレビュー・仕上がりPDF・塗り足しPDF・JPG の置き方を決める。挿絵の枠の縦横比のまま、仕上がり＋塗り足し 3mm を覆い、はみ出しは紙で切る。仕上がりPDF でも塗り足しPDF と同じ所が仕上がりの内側に出る。プレビューもこの箱に描く（前は CSS の object-fit）。 |
| Web閲覧用・SNS用の置き場 | 柱・ノンブル・本文の枠を、印刷用と同じ共通の置き場（`editorFurnitureGeometry`、`furnitureGeometry.ts`）で決める。前は px の用紙だけ書き出しが別の古い置き方だった。Web閲覧用と「SNS用 4:5」のクレジットありは、ノンブルを左下の角（左16px・下15px、`folioCorner`）に置く（プレビューの前からの位置。下の欄と重ならない）。 |
| Web閲覧用・SNS用の柱・ノンブル | プレビューも本文と同じ割合の大きさ（JPG と同じ）にして、字の形で描く（印刷用と同じ）。JPG は設定の大きさを使う。 |
| Web閲覧用の下の欄 | 寸法を `src/lib/webFooterLayout.ts` に1つにまとめ、プレビュー（CSS）と JPG（`drawWebFooter`、Canvas）が同じ寸法で描く。 |
| SNS用 4:5 のクレジット | JPG の文字を CSS と同じ決め方（行の箱の中央）で置く。線の位置も 1px 合わせた。 |
| 柱の 𠮷 など（TSP-PRINT-003 の点検の9番） | PDF の柱・ノンブルも字の形で描く（`furnitureRunGlyphs`）。jsPDF が BMP の外の字を2字と数えてずれていたのと、書体にない字で柱が途中で切れていたのが直る。書体にない字は、PDF に入っている別の書体（本文の書体が先）から字を取り、どれにもなければ書体の「字がない」印を出す（柱は切れない）。ノンブルの書体を別にした時、その書体は PDF に文字として埋め込まれず、字の形として入る。 |

## はかった結果（直した後、この環境）

- `npm run test:e2e:illustration-parity`: 印刷用（文庫・塗り足しPDF・A5 2段組）の挿絵はすべて 0.082mm 以内。Web閲覧用・SNS用（JPG の画素、紙の 1px = 2画素）は挿絵 0、柱・ノンブル 3画素以内、下の欄・クレジット 1〜4画素（プレビュー側は画面写真なので、カードの小数点以下の位置で 2画素ほど動く）。
- `npm run test:e2e:furniture-parity`: 柱に 𠮷・𩸽 を入れた場面を足した。すべて 0.083mm 以内。Web閲覧用も字の形で描いていることを確かめる。
- 見比べ画像: `/mnt/project-files/TateSpun/tsp-print-004/`（full-image-pdf.png、web-footer-jpg.png、web-page.png）。

## 確かめたこと

- `npm run test:all` 3902 合格・失敗 0、`npx tsc --noEmit`、lint（前と同じ 173 件）、`next build --webpack`。
- 新しいテスト: `fullPageCover.test.ts`、`furnitureRunGlyphs.test.ts`、`webFooterCanvas.test.ts`、`pageDecorationParity.test.ts`（Web閲覧用・SNS用の置き場）。変えたテスト: Web閲覧用は古い置き方のまま、という前のテスト／Web の JPG は 15/20pt 固定、というテスト／ノンブルの書体が文字として埋め込まれる、というテスト。

## 気づいたが直していないこと（理由）

- 柱に、選んだ書体にない字がある時、プレビューと JPG はブラウザの別の書体の字で出るが、PDF は PDF に入っている書体にその字がなければ「字がない」印になる。PDF には同梱の書体しか入れられないため。本文の字も同じ扱い。
- LEGACY（緊急の戻し）の画面は直していない（下の欄・全面は前のまま）。LEGACY を消すかどうかは、なつおが決める。

## 次にすること

- 古い組み方（LEGACY）を消すか残すか、なつおに聞く。
