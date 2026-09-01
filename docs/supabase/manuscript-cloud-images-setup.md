# TSP-LOOP-007 — 作品挿絵の 72h 一時クラウド同期 セットアップ

クラウド作品を別端末で開いても挿絵が復元できるようにする（従来は IndexedDB
ローカルのみで、別端末では画像欠損）。**このリポジトリからは自動適用されない。**

```
PC: 画像挿入 → 「クラウドに保存」
      ├─ projects 行更新（title / content / settings）           … 従来どおり
      └─ syncManuscriptImages()（ユーザー自身のセッション）
           ├─ 参照画像を private bucket `manuscript-cloud-images` へ upload
           ├─ public.manuscript_cloud_images を upsert（全行 同一 expires_at = now+72h）
           └─ 参照されなくなった行 + object を掃除
別端末: クラウド作品を開く → restoreManuscriptImages()
           ├─ manifest 取得 → 各 object を download → 元の image id で復元
           └─ 取得失敗した行は missing=true（本棚が ⚠️ 表示）
定期: manuscript-image-purge Edge Function（pg_cron）
           └─ expires_at <= now() の Storage object を削除し、manifest 行は
              missing=true の tombstone として残す（冪等）。
              → 72h 後にオブジェクトが消えても、背表紙は「画像削除済み・再配置」を
                継続表示できる。行が消えるのは本文マーカー削除＋再保存 or 作品削除のみ。
```

- **canonical**: 本文 title/settings は DB、挿絵の実体は private Storage（72h）、
  元画像は端末 IndexedDB（cloud 期限切れでも消さない）。
- **期限延長条件**: 画像を含むクラウド保存が *完全成功*（全参照画像が cloud に
  そろい manifest 更新成功）した時点から 72h。DB 保存だけ成功では延長しない。
- **canonical 定数**: `CLOUD_IMAGE_TTL_HOURS = 72` / `CLOUD_IMAGE_WARNING_HOURS = 5`
  （`src/lib/cloudImageSync.ts`）。

## 1. DB / Storage（要 remote apply）

`docs/supabase/migrations/20260901010000_manuscript_cloud_images.sql` を Supabase
SQL エディタで実行（冪等・トランザクション・非破壊）。内容:

- `public.manuscript_cloud_images`（PK: project_id + local_image_id、`expires_at`
  共有、`missing` フラグ、`projects` へ FK `on delete cascade`）
- RLS: authenticated は **自分の user_id かつ自分が所有する project** の行のみ
  CRUD。anon は不可。
- private bucket `manuscript-cloud-images`（public=false、15 MiB / 画像、
  MIME allowlist）
- `storage.objects` ポリシー: このバケットの object は
  `(<userId>/<projectId>/<imageId>.<ext>)` の先頭セグメント = `auth.uid()` の
  場合のみ CRUD 可
- `beta-feedback-images` バケット / TSP-LOOP-006 には一切触れない

## 2. purge Edge Function（要 deploy + Cron）

```
supabase functions deploy manuscript-image-purge --project-ref rgvqquuthovqjqfogfra
```

Secrets（Edge Function 環境）:

| 変数 | 用途 |
|---|---|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase 自動注入 |
| `MANUSCRIPT_IMAGE_PURGE_SECRET`（任意） | Cron 用の共有シークレット。未設定なら service-role キーで認証 |

Cron（pg_cron + pg_net。例: 1 時間ごと）— Supabase SQL エディタで:

```sql
select cron.schedule(
  'manuscript-image-purge-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url    := 'https://rgvqquuthovqjqfogfra.functions.supabase.co/manuscript-image-purge',
    headers:= jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body   := '{}'::jsonb
  );
  $$
);
```

（サービスロールキーの受け渡し方法はプロジェクトの pg_net 運用に合わせる。
`MANUSCRIPT_IMAGE_PURGE_SECRET` を使う場合は `Bearer <その値>`。）

### purge の挙動（tombstone / race 安全）

- 対象は `expires_at <= now() AND missing = false` の行のみ。
- **Storage オブジェクトは削除するが、manifest 行は削除しない**。実体削除に成功した
  行を `missing = true`（`expires_at` はそのまま）にして tombstone として残す。
  → 72h 後にオブジェクトが消えても、背表紙は「画像削除済み・再配置」を継続表示できる。
- 行が物理的に消えるのは「本文マーカー削除＋再保存」または「作品削除」のときだけ。
- **世代付き Storage パス**（`<uid>/<pid>/<imgId>/<generation>.<ext>`）:
  アップロード成功のたびに新しい世代へ書く（deterministic な上書きはしない）。
  古い purge 実行は SELECT した「その世代」のオブジェクトしか remove できず、
  再同期で作られた新世代オブジェクトへは物理的に触れられない。
- tombstone UPDATE は三重ガード（`missing=false` / `expires_at<=capturedNow` /
  `storage_path = SELECT した世代`）。再同期で新世代へ切り替わった行は、古い
  worker からは tombstone されない。
- 実削除が cron 間隔ぶん遅れても、UI は `expires_at` 到達時点で「期限切れ」を表示する。
- 再同期時に古い世代オブジェクトは best-effort で掃除する。掃除に失敗して孤児が
  残っても、次回その画像を再同期したとき（世代フォルダ列挙）と作品削除時に回収される。

## 3. 本棚 / 作品詳細の警告（フロント・コミット済み・deploy 未実施）

`src/lib/cloudImageSync.ts` の `computeCloudImageWarning({ hasReferencedImages,
expiresAt, missing }, now)` が唯一の真実源:

| 条件 | status | 背表紙 | 文言（hover / tap / aria 共通） |
|---|---|---|---|
| 参照画像なし / 健全で > 5h | NONE | 表示なし | — |
| 0 < 残り <= 5h | EXPIRING | ⚠️ | `削除まであと約N時間` |
| 期限内なのに Storage 取得不能 | MISSING | ⚠️ | `画像を取得できません・再配置をお願いします` |
| `expires_at <= now`（purge 済み / 待ち） | EXPIRED_DELETED | ⚠️（継続） | `画像削除済み・再配置をお願いします` |
| 元端末等で再保存し全再 upload + manifest 更新成功 | NONE | ⚠️ 解除 | — |

- 唯一の真実源は `computeCloudImageWarning(status, now)`（`src/lib/cloudImageSync.ts`）。
  デスクトップ hover・モバイル tap・作品詳細・エディタ帯・エクスポートブロック・
  期限切れプレースホルダ、すべてこの1関数由来。UI ごとの独自条件分岐なし。
- 「元の端末から保存すれば復元できる」とは言わない（72h 後は cloud も現端末の
  local original も無いことがある）。canonical は「再配置」。
- 本棚は **1 クエリ**（`getProjectCloudImageMetas`）だけを見る。背表紙ごとの
  Storage HEAD は発行しない。
- ⚠️ は開くボタンの外にある独立した `<button>`（tap で作品を誤って開かない）。
  hover で `title`、tap で作品詳細ダイアログ（backdrop / Escape / close ボタン付き・
  モバイル対応）が開き、同じ文言 + 詳細行を表示する。

## 期限切れ画像プレースホルダ（UI のみ）

クラウド作品を開いて本文マーカーはあるが画像が期限切れ / 欠損の場合、その画像位置に
`/caroad_main1.png`（サイトのトップ画像）を薄く敷いた枠 + `⚠️ 画像の保存期限が
切れています / 画像を再度配置してください` を表示する。「何も表示しない」はしない。

このプレースホルダは **UI state のみ**。`content` / IndexedDB / Supabase Storage /
PDF・JPG には一切入らない（`data-no-print` でエクスポート捕捉からも除外。そもそも
未解決画像があるとエクスポート自体がブロックされる）。

## エクスポートブロック

本文が参照する画像に期限切れ / 欠損 / 未解決が **1 件でもあれば**、JPG・PDF の
書き出しを完全ブロックする（「抜けるかも」という警告ではなく、モーダルを出して
OK を押しても開始しない）。全画像が解決したときのみ書き出し可能。本文に画像
マーカーが無い作品は影響なし。

## 4. プライバシー

- 挿絵は private。公開 URL を固定保存しない（manifest には storage path のみ、
  期限切れになる signed URL は永続記録に使わない）。
- クライアントは **ログインユーザー自身のセッション**でのみ Storage / manifest を
  操作する。service-role キーはブラウザに出さない。
- EXIF 等のメタデータ加工は **このループでは変更しない**（挿入時の既存挙動の
  まま。元画像バイトをそのまま upload / download する）。

## 5. Human QA 前の外部適用チェック

1. `20260901010000_manuscript_cloud_images.sql` を本番 Supabase に適用
2. `supabase functions deploy manuscript-image-purge`
3. `MANUSCRIPT_IMAGE_PURGE_SECRET`（任意）を Edge Function に設定
4. pg_cron ジョブを登録（例: 毎時）
5. `NEXT_PUBLIC_BETA_FEEDBACK_ENABLED` 等と同様、フロントをプレビュー環境へビルド
