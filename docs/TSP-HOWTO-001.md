# TSP-HOWTO-001 — HOW TO redesign (`/howto-v2`)

- Design: なつお's 「HOW TO TateSpun 再設計案」 canvas (2026-10-04).
- Built beside the live `/howto` (untouched) at `src/app/howto-v2/`; noindex, canonical → /tatespun/howto.
- 5選 re-picked (なつお OK): 原稿の持ち込み / 本文記法 / 設定 / プレビュー / 書き出し(＋マイチェック).
- 小技10選 re-picked (なつお OK): 保存の場所 / 4ボタン / メモ・プロット / 集中モード / 3D / かんたん表紙 / 目次と奥付 / ノンブル・柱 / 画像挿入 / SNS用の縦書き画像.
- Existing chapter copy moved verbatim; new lines listed for review in the project file `TateSpun/tsp-howto-001/COPY_CHANGES.md`.
- Preview images: real editor screenshots (Playwright, 1440×900 @2x, cropped, ≤1200px JPG) in `public/howto/assets/v2/`.
- Kept: update log newest 3 + fold (TSP-HISTORY-001), old anchors (#varied-use, #export, #settings, #image-insert, #review-tools, #use-cases …) open the matching tab / dialog.
- Swap to `/howto` only after Human QA.

## Round 2–3 (なつお, 2026-10-04 evening)
- Hero: guide cat and the design's open book cross-fade every 6 s (dots switch by hand; reduced motion stays on the cat).
- SNS wording: any paper's JPG can be posted / used as a 書店委託 sample; SNS paper is only for X-shaped images (C3 and tip 10).
- `src/lib/sisterTools.ts`: COLUMNSTAND and ことばテラス rows under 「小説の本のほかにも」, on both Home and HOW TO.
- Video removed from HOW TO; replaced by a 「デモで実際に触ってみる」 row and a 「使い方ガイドの本をひらく」 row (registers the sample book first, then opens `/editor?id=-1`).
- 23:23 JST なつお: 「並べたら公開してください」 → published with `/howto-v2` still beside `/howto` (noindex); the swap is a separate step.
- 23:35 JST なつお「入れ替えて」→ the redesign now lives at `/howto` (indexable, same title/description/canonical as before). The previous design moved to `/howto-v1` (noindex, canonical → /howto); `/howto-v2` forwards to `/howto`, keeping the #chapter.
