// TSP-LOOP-007 — 期限切れの「作品一時クラウド挿絵」の *実体だけ* を定期削除する.
//
// canonical 期限 = manuscript_cloud_images.expires_at。cron 間隔で多少遅れて
// 実削除されても、UI 側は expires_at 到達時点で「期限切れ」を表示する。
//
// 重要（TSP-LOOP-007 FINAL PATCH §1）:
//   Storage オブジェクトは削除するが、**manifest 行は削除しない**。
//   `missing = true` にして tombstone として残す（expires_at は元のまま）。
//   これにより 72h 後にオブジェクトが物理削除された後も、
//     missing=true AND expires_at <= now  → 「画像削除済み・再配置」
//   を作品一覧の背表紙へ継続表示できる。行が本当に消えるのは
//     - 本文からその画像マーカーが削除されて再保存されたとき（sync の Phase 3）
//     - プロジェクト削除（FK cascade / deleteManuscriptImagesForProject）
//   のみ。
//
// 手順（冪等・複数回走っても安全）:
//   1. expires_at <= now() かつ missing=false の manifest 行を取得
//   2. 行の storage_path から object キーを厳密に復元（listing に頼らない）
//   3. Storage API で object を削除（Supabase 公式方法。DB から直接消さない）
//   4. その manifest 行を missing=true に更新（削除しない）
//   5. 関係ない object / bucket / 未期限行には一切触れない
//
// トリガ: pg_cron + pg_net から service-role キー（または PURGE_SECRET）付きで
// POST する。詳細は docs/supabase/manuscript-cloud-images-setup.md。
//
// SECURITY:
//   - service-role キーは Deno.env（Supabase 自動注入）のみ。応答/ログに出さない。
//   - 呼び出しは Authorization ヘッダ検証必須（未認証は 401）。
//   - この関数は manuscript-cloud-images bucket 以外を絶対に触らない。

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const BUCKET = "manuscript-cloud-images";
const BATCH = 500;

const env = (k: string) => Deno.env.get(k) ?? "";
const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const PURGE_SECRET = env("MANUSCRIPT_IMAGE_PURGE_SECRET");

function authorized(req: Request): boolean {
  const h = req.headers.get("authorization") ?? "";
  const token = h.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  // service-role キー、または専用シークレットのどちらかで許可。
  return (
    (SERVICE_ROLE_KEY.length > 0 && token === SERVICE_ROLE_KEY) ||
    (PURGE_SECRET.length > 0 && token === PURGE_SECRET)
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!authorized(req)) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const nowIso = new Date().toISOString();
  let scanned = 0;
  let objectsDeleted = 0;
  let rowsTombstoned = 0;
  const errors: string[] = [];

  // 期限切れ かつ まだ実体削除していない (missing=false) 行のみ。
  // missing=true の行は既に tombstone 済み → 再処理不要（冪等）。
  for (let round = 0; round < 100; round++) {
    const { data: rows, error } = await supabase
      .from("manuscript_cloud_images")
      .select("project_id, local_image_id, storage_path")
      .lte("expires_at", nowIso)
      .eq("missing", false)
      .limit(BATCH);
    if (error) {
      errors.push(`select: ${error.message}`);
      break;
    }
    if (!rows || rows.length === 0) break;
    scanned += rows.length;

    // 2. storage_path -> object キー（"<bucket>/<key>" 形式のみ受理）。
    for (const r of rows) {
      const prefix = `${BUCKET}/`;
      let key: string | null = null;
      if (typeof r.storage_path === "string" && r.storage_path.startsWith(prefix)) {
        const k = r.storage_path.slice(prefix.length);
        if (!k.includes("..") && !k.startsWith("/")) key = k;
      }

      // 3. Storage 実体削除（存在しないキーも Supabase は許容＝冪等）。
      //    想定外パスなら object には触れず、行だけ tombstone する。
      if (key) {
        // 世代付きパス（<uid>/<pid>/<imgId>/<generation>.<ext>）なので、この
        // remove は SELECT した「その世代」しか消せない。再同期後の新オブジェクトは
        // 別世代パス＝物理的に触れない（race 対策の要）。
        const { error: rmErr } = await supabase.storage.from(BUCKET).remove([key]);
        if (rmErr) {
          errors.push(`remove(${r.project_id}/${r.local_image_id}): ${rmErr.message}`);
          continue; // 実体が消せていない → 次回に再挑戦（tombstone しない）
        }
        objectsDeleted += 1;
      }

      // 4. manifest 行は **削除せず** missing=true の tombstone にする。
      //    三重ガード:
      //      - missing=false        （既に tombstone 済みは対象外）
      //      - expires_at <= nowIso （走行中に +72h 延長された行は対象外）
      //      - storage_path = 読み取った世代パス
      //        （再同期で新世代へ切り替わった行は対象外＝古い worker が
      //         healthy な行を tombstone しない）
      const { error: updErr } = await supabase
        .from("manuscript_cloud_images")
        .update({ missing: true, updated_at: new Date().toISOString() })
        .eq("project_id", r.project_id)
        .eq("local_image_id", r.local_image_id)
        .eq("missing", false)
        .eq("storage_path", r.storage_path)
        .lte("expires_at", nowIso);
      if (updErr) errors.push(`tombstone(${r.project_id}/${r.local_image_id}): ${updErr.message}`);
      else rowsTombstoned += 1;
    }

    if (rows.length < BATCH) break;
  }

  console.error(
    JSON.stringify({
      task: "manuscript-image-purge",
      scanned,
      objectsDeleted,
      rowsTombstoned,
      errorCount: errors.length,
    }),
  );

  return new Response(
    JSON.stringify({ ok: errors.length === 0, scanned, objectsDeleted, rowsTombstoned, errors }),
    { status: errors.length === 0 ? 200 : 207, headers: { "Content-Type": "application/json" } },
  );
});
