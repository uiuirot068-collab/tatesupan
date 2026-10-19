# TSP-SAFE-007 ほかのサイトへの埋めこみ禁止（2026-10-19）

ChatGPT の査定（なつおが貼ったもの）をコードと本番で確かめ、「今やる」とされた埋めこみ禁止だけを入れる。

## したこと

- public/_headers に `Content-Security-Policy: frame-ancestors 'none'` と `X-Frame-Options: DENY` を足した。ほかのサイトが TateSpun の画面を枠（iframe）に入れて、知らないうちにボタンを押させる手口を防ぐ。
- TateSpun を枠に入れて出している正規の画面は無い（spuntales.net のトップ・TateSpun の中とも。開発用の renderer-poc は TateSpun を枠に入れていない）。
- 書き出しのときに out/_headers（いちばん上）へ移る（SAFE-005 の build-basepath.mjs）。
- src/lib/securityHeaders.test.ts で、守りの設定が消えていないかを見る。

## しなかったこと（理由）

- 読みこみ元を絞る CSP 全体: Next の静的書き出しはページに直接スクリプトを書くので、絞ると画面が止まる。まず「報告だけ」で調べる段取りが要る（ChatGPT も「後で」）。
- 画像の自動削除: なつおが新しい Supabase（vjgx）で確かめ、毎時の予定が動いていて、期限切れで残っている画像は0件。直す必要なし。
- ご意見の回数制限: Turnstile のサーバー側の確かめがあり、迷惑投稿も無いので今のまま（ChatGPT も見送り）。

## 確かめ

- npm run test:all、tsc、eslint。
- 公開後: spuntales.net/tatespun/ と tatespun.pages.dev/tatespun/ の応答に2つのヘッダーが付いているか。本棚・エディタ・保存・PDF/JPG・ログイン・ご意見フォームがいつもどおりか。
