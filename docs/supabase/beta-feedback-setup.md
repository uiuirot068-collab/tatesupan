# TSP-LOOP-006 — β版フィードバック セットアップ / 運用メモ

匿名フィードバック機能（`報告` ボタン）のバックエンド構成と、Human QA 前に必要な
外部適用手順。**このリポジトリからは自動適用されない。**

```
TateSpun static frontend (tatespun.pages.dev)
  └─ POST {SUPABASE_URL}/functions/v1/beta-feedback   ← 匿名・公開・CORS allowlist
       ├─ Supabase Storage  : private bucket `beta-feedback-images`  (canonical image)
       ├─ Google Apps Script : Web App → Spreadsheet 「気になる事」「review」 (canonical record)
       └─ Discord Webhooks   : feedback / review 別 FORUM チャンネル (対応管理用)
```

**Discord は FORUM チャンネル**（TEXT ではない）。1 件ごとに独立したフォーラム投稿を
作り、Human が Discord 上で確認・返信・対応状況を手動タグ管理できるようにする。
Webhook 実行時に `thread_name` を毎回付けて新規スレッドを作成する（`thread_id` 方式は
使わない）。`applied_tags` の自動付与は今回未実装（POST-BETA 候補）。既存 Webhook URL は
そのまま／新しい Discord secret・channel ID は不要。

- canonical record = Spreadsheet。Spreadsheet 追記が成功して初めて送信成功。
- Discord のみ失敗 → record は残す。ユーザーへ再送を促さない（重複防止）。
- Storage 失敗（画像付き）→ 送信失敗。孤立 object は best-effort で削除。
- 原稿本文・作品タイトル・ドキュメント ID・アカウント情報は一切収集しない。

## 1. フロント（コミット対象・deploy 未実施）

| 項目 | 値 |
|---|---|
| feature flag | `NEXT_PUBLIC_BETA_FEEDBACK_ENABLED=true`（公開値。secret ではない） |
| flag OFF / 未設定 | `報告` ボタン非表示・モーダル到達不能 |
| 呼び先 | `NEXT_PUBLIC_SUPABASE_URL` から導出（ハードコードなし） |

β 終了時は `NEXT_PUBLIC_BETA_FEEDBACK_ENABLED` を外して再ビルドするだけで UI から消える。

## 2. Supabase Edge Function `beta-feedback`

デプロイ:

```
supabase functions deploy beta-feedback --project-ref vjgxrqgnbgnewfvissgd
# config.toml の [functions.beta-feedback] verify_jwt = false で匿名呼び出し可
# TSP-LOOP-017: canonical project = vjgxrqgnbgnewfvissgd. LOOP-014 の
# IMAGE_ATTACHMENTS_ENABLED = false（画像添付拒否）を含む repo 版をそのまま deploy する。
```

必要 Secrets（**すべて Supabase 側。repo・client・log に出さない**）:

| Secret | 用途 | 登録状況 |
|---|---|---|
| `DISCORD_FEEDBACK_WEBHOOK_URL` | 気になる事チャンネル | Human 登録済み |
| `DISCORD_REVIEW_WEBHOOK_URL` | review チャンネル | Human 登録済み |
| `GOOGLE_APPS_SCRIPT_URL` | Apps Script Web App | Human 登録済み |
| `GOOGLE_APPS_SCRIPT_SECRET` | Apps Script 共有シークレット（= Script Property `TATESPUN_FEEDBACK_SECRET`） | Human 登録済み |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Storage 書き込み | Supabase 組込（自動注入） |
| `BETA_FEEDBACK_ALLOWED_ORIGINS` | CORS allowlist（任意・カンマ区切り） | 未設定なら `https://tatespun.pages.dev, http://localhost:3000` |

## 3. Storage バケット

`docs/supabase/migrations/20260901000000_beta_feedback_storage.sql` を Supabase SQL
エディタで実行（または Storage UI で以下を再現）:

- バケット `beta-feedback-images` / **public = false**
- `file_size_limit = 5 MiB` / `allowed_mime_types = image/jpeg,image/png,image/webp`
- RLS ポリシーは追加しない（service_role 経由の Edge Function のみ書き込み可）

object key: `beta-feedback-images/<reportId>/<uuid>.<ext>`（元ファイル名は使わない）。
Spreadsheet にはこの path を保存（署名付き URL は期限切れになるため永続記録に使わない）。

## 4. Google Apps Script 契約（Human 側で deploy 済み）

Web App は JSON POST を受け、`body.secret === TATESPUN_FEEDBACK_SECRET` を検証し、
`{ ok: true }` を返す。`ok:false` / 非 200 は Edge Function 側で失敗扱い。

### feedback → シート「気になる事」

```
{ secret, type:"feedback", receivedAt, reportId, appVersion, path, viewport,
  message, images: string[], discordStatus }
```
列: `receivedAt reportId appVersion path viewport message imageCount image1..image4 discordStatus`

### review → シート「review」

```
{ secret, type:"review", receivedAt, reportId, appVersion, path, viewport,
  checkedCount, reviewItems, note, discordStatus }
```
列: `receivedAt reportId appVersion path viewport checkedCount reviewItems note discordStatus`

Apps Script 側は formula injection 対策（先頭 `= + - @` の無害化 / セル長制限）を実装済み。

## 5. Discord（FORUM チャンネル）

`allowed_mentions: { parse: [] }` 固定。`@everyone` `@here` `<@id>` は発火しない。
2000 字超は安全に truncate し「全文はスプレッドシートを確認」を付す（全文はシートに保存）。

Webhook 実行時:

- `thread_name` を毎回付与し、フォーラム投稿を新規作成（`thread_id` は使わない）
- URL に `?wait=true` を付けて Discord の受理を待ち、`discordStatus="sent"` の精度を上げる
  （URL 自体は log しない）

スレッドタイトル（`thread_name`、100 字上限・改行/制御文字を除去）:

- feedback（本文あり）: `気になる事｜<reportId 先頭8>｜<本文先頭を安全短縮>`
- feedback（画像のみ）: `気になる事｜<reportId 先頭8>｜画像のみ`
- review: `review｜<reportId 先頭8>｜<checkedCount>/15`
- reportId 先頭 8 文字を必ず含め、Spreadsheet 行と照合できる

本文:

- feedback: `【TateSpun β / 気になる事】` + 本文 + 画像 最大4枚（webhook multipart, `files[i]`）
- review: `【TateSpun β / review】` + チェックリスト + メモ（画像なし, JSON body）

## 6. metadata（EXIF）ストリッピング

**未実装。** 受信した画像バイナリはそのまま Storage / Discord へ渡す（再エンコード用の
画像処理依存を追加しない方針）。マジックバイト検証は実施。モーダルに
「画像内に個人情報が含まれていないか送信前に確認」の注意を表示している。

## 7. Human QA 前チェック（外部適用が必要な項目）

1. `20260901000000_beta_feedback_storage.sql` を本番 Supabase に適用
2. `supabase functions deploy beta-feedback`（**Forum 対応で index.ts 変更あり → 再 deploy 必須**）
3. 上記 Secrets が Edge Function 環境に存在することを確認
4. Discord の feedback / review チャンネルが **FORUM チャンネル**であること（TEXT では
   `thread_name` が無視され通常メッセージになる。動作はするが 1 件 1 スレッドにならない）。
   Forum 設定の「投稿にタグを必須にする」は **OFF** にする（ON だと `applied_tags` を
   送っていない webhook 投稿が 400 で弾かれる。その場合も Spreadsheet 記録は残り
   `discordStatus=failed` になるだけ）
5. `NEXT_PUBLIC_BETA_FEEDBACK_ENABLED=true` でフロントをプレビュー環境へビルド
