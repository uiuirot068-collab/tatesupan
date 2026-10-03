// CST-PORT-014: クラウドの新旧比較（COLUMNSTAND B5 から）。
//
// COLUMNSTAND は作品を開くとき、端末版よりクラウド版の方が新しければ
// 「どちらを使うか」を確認する。TateSpun はクラウド作品を開くといつも
// クラウドから読み込むので、開くときに食い違いは起きない。食い違うのは
// 「この画面で開いた（または保存した）あとに、別の端末やタブでクラウドへ
// 保存された」ときで、そのまま「クラウドに保存」すると新しい方を黙って
// 上書きしてしまう。そこで保存の直前に比べ、クラウド版の方が新しければ
// 確認画面を出す。
//
// 比べるのは projects.updated_at（データベースが更新のたびに付ける時刻、
// docs/supabase/migrations/20260912000000_projects_updated_at_trigger.sql）。
// 端末の時計は使わない。

/**
 * `base` = この画面が最後に読んだ・保存したクラウド版の updated_at。
 * `cloud` = いまクラウドにある版の updated_at。
 * どちらかが無い・読めないときは「新しくない」とみなし、これまでどおり保存する。
 */
export function isCloudVersionNewer(cloud: string | null | undefined, base: string | null | undefined): boolean {
  if (!cloud || !base) return false;
  if (cloud === base) return false;
  const cloudMs = Date.parse(cloud);
  const baseMs = Date.parse(base);
  if (!Number.isFinite(cloudMs) || !Number.isFinite(baseMs)) return false;
  return cloudMs > baseMs;
}

export interface CloudVersionBase {
  updatedAt: string | null;
  title: string;
  content: string;
}

/**
 * クラウドの今の版が、この画面が最後に読んだ・保存した版から変わったか。
 * 時刻（updated_at）が新しいとき、または題名・本文が違うとき。
 * 時刻だけに頼らないのは、時刻が変わらない保存（データベースの時刻の
 * 付け方が古いままの場合など）でも、中身が違えば確かめるため。
 */
export function isCloudVersionChanged(
  cloud: { updated_at?: string | null; title: string; content: string },
  base: CloudVersionBase | null
): boolean {
  if (!base) return false;
  if (isCloudVersionNewer(cloud.updated_at, base.updatedAt)) return true;
  return cloud.title !== base.title || cloud.content !== base.content;
}

const pad2 = (value: number) => String(value).padStart(2, "0");

/** 確認画面に出す日時（端末の時刻で「10/3 16:05」）。 */
export function formatCloudVersionTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return `${date.getMonth() + 1}/${date.getDate()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** 「クラウド版を開く」で、この画面の版を本棚に残すときの題名。 */
export function cloudCompareLocalCopyTitle(title: string): string {
  const base = title.trim() || "無題";
  return `${base}（この端末の控え）`;
}

export const CLOUD_COMPARE_COPY = {
  title: "クラウド版の方が新しい原稿です",
  lead: "この画面で開いた（または保存した）あとに、別の端末やタブからクラウドへ保存されています。どちらを使うか選んでください。",
  screenLabel: "この画面の版",
  cloudLabel: "クラウド版",
  screenTimeLabel: "開いた・保存した時刻",
  cloudTimeLabel: "クラウドの保存時刻",
  overwrite: "この画面の版で上書き保存",
  overwriteNote: "クラウド版は、この画面の版に置き換わります。",
  openCloud: "クラウド版を開く",
  openCloudNote: "この画面の版は、本棚に「この端末の控え」として残します。",
  cancel: "やめる",
} as const;
