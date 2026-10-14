# TateSpun の公開経路（TSP-IMPROVE-002 / P0-2）

最終確認: 2026-10-14（リポジトリから読める範囲。Cloudflare の管理画面での確認は P0-1、なつお待ち）

## 本番（お客さんが見る場所）

- URL: https://spuntales.net/tatespun/
- 配っているもの: **Cloudflare Pages のプロジェクト `tatespun`**（と読める。P0-1 で画面確認）
- きっかけ: `master` への push
- ビルド命令: `npm run build:basepath`（`scripts/build-basepath.mjs`）
  1. `scripts/verify-supabase-project.mjs` — Supabase の接続先が vjgx（vjgxrqgnbgnewfvissgd）以外なら止める
  2. `NEXT_PUBLIC_BASE_PATH=/tatespun` で `next build`（静的書き出し、`out/`）
  3. `scripts/nest-export.mjs` — `out/tatespun/` に入れなおす
  4. `out/_redirects` — `/` を `/tatespun/` へ 302
- 出力フォルダ: `out`
- 必要な環境変数（名前だけ）: `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`NEXT_PUBLIC_BETA_FEEDBACK_SUPABASE_URL`、`NEXT_PUBLIC_BETA_FEEDBACK_SUPABASE_ANON_KEY`
- master 以外のブランチのプレビュー（pages.dev）は毎回失敗する（環境変数が本番にしか無いと見られる）。Human QA はなつおの PC で行う。

## GitHub Pages（本番ではない）

- `.github/workflows/deploy.yml`。`master` への push のたびに `npm run build`（basePath なし）を GitHub Pages に出していた（2026-10-13 の run 102 まで成功）。
- basePath が無いので `/tatesupan/` の下では画面の部品が読めない見込みで、spuntales.net とも関係がない。
- **TSP-IMPROVE-002 で `workflow_dispatch`（Actions の画面で手で押した時だけ）に変えた。** ファイルは消していない。
- 戻し方: `deploy.yml` の `on:` に `push: branches: [master]` を戻す。
- GitHub の Settings → Pages を止めるかどうかは、なつおの判断（P0-1 の結果しだい）。

## push の前後

- tatesupan の master と caroad の master は同時に push しない（コーディネーターに一言）。
- push したら Cloudflare の `tatespun` のデプロイが成功したかを確認し、https://spuntales.net/tatespun/ を開いて確かめる。
