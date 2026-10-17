# TateSpun の公開経路（TSP-IMPROVE-002 / P0-2）

最終確認: 2026-10-17（なつおが Cloudflare・GitHub の設定画面のスクショで確認、P0-1）

## 本番（お客さんが見る場所）

- URL: https://spuntales.net/tatespun/
- 配っているもの: **Cloudflare Pages のプロジェクト `tatespun`**（Git 接続 uiuirot068-collab/tatesupan）
- きっかけ: `master` への push（本番ブランチ master、自動デプロイ有効、監視するパス `*`、ビルドの作り Version 3、キャッシュなし）
- ビルド命令: `npm run build:basepath`（`scripts/build-basepath.mjs`）
  1. `scripts/verify-supabase-project.mjs` — Supabase の接続先が vjgx（vjgxrqgnbgnewfvissgd）以外なら止める
  2. `NEXT_PUBLIC_BASE_PATH=/tatespun` で `next build`（静的書き出し、`out/`）
  3. `scripts/nest-export.mjs` — `out/tatespun/` に入れなおす
  4. `out/_redirects` — `/` を `/tatespun/` へ 302
- 出力フォルダ: `out`
- 環境変数（Cloudflare 側に 10 個、すべて Text。画面で名前の頭だけ見えたもの）: `NEXT_PUBLIC_BASE_PA…`、`NEXT_PUBLIC_BETA_FEE…` ×3、`NEXT_PUBLIC_SUPABAS…` ×2、`NEXT_PUBLIC_TATESPU…` ×2、`NEXT_PUBLIC_TURNSTI…`、`TATESPUN_LOCK_CANC…`
- master 以外のブランチのプレビュー（pages.dev）は毎回失敗する（環境変数が本番にしか無いと見られる）。Human QA はなつおの PC で行う。

## GitHub Pages（本番ではない）

- 2026-10-17 なつおが「Unpublish site」で公開を止めた（それまで https://uiuirot068-collab.github.io/tatesupan/ に古い写しが出ていた）。
- `.github/workflows/deploy.yml`。`master` への push のたびに `npm run build`（basePath なし）を GitHub Pages に出していた（2026-10-13 の run 102 まで成功）。
- basePath が無いので `/tatesupan/` の下では画面の部品が読めない見込みで、spuntales.net とも関係がない。
- **TSP-IMPROVE-002 で `workflow_dispatch`（Actions の画面で手で押した時だけ）に変えた。** ファイルは消していない。
- 戻し方: `deploy.yml` の `on:` に `push: branches: [master]` を戻す。
- もう一度出す時は、Actions の画面から「Deploy to GitHub Pages」を手で実行する。

## push の前後

- tatesupan の master と caroad の master は同時に push しない（コーディネーターに一言）。
- push したら Cloudflare の `tatespun` のデプロイが成功したかを確認し、https://spuntales.net/tatespun/ を開いて確かめる。
