/**
 * TSP-SUPPORT-LINKS-001 — SpunTales-wide support destinations (FANBOX / OFUSE).
 *
 * Shared between the HOME (`src/app/page.tsx`) and HOW TO (`src/app/howto/page.tsx`)
 * bottom areas so both pages use the identical copy and exact URLs. Not
 * TateSpun-specific: these are the operator's (caroad) SpunTales-wide support
 * destinations, distinct from the HOW TO page's separate, config-gated
 * Amazon/Rakuten "お買い物リンク" section (`resolveAffiliateFooterConfig` in
 * `howtoContent.ts`), which has its own, unrelated compliance wording rules.
 */

export const SUPPORT_FANBOX_URL = "https://www.fanbox.cc/@caroad";
export const SUPPORT_OFUSE_URL = "https://ofuse.me/caroad";

// SPN-SUPPORT-001: SpunTales全体の応援欄（caroad assets/js/support-note.js、
// Pairlex・Moorlia）と同じやわらかい言い方にそろえる。OFUSE（1回ごと）が先、FANBOX（毎月）が後。
export const SUPPORT_HEADING = "SpunTalesを応援する";
export const SUPPORT_BODY =
  "TateSpunを気に入っていただけたら、開発の応援をしてもらえるとうれしいです。";
export const SUPPORT_OFUSE_LABEL = "☕ OFUSEで応援";
export const SUPPORT_FANBOX_LABEL = "🍰 FANBOXで応援";
export const SUPPORT_NOTE =
  "OFUSEは1回ごと、FANBOXは毎月の応援です。応援の有無で、使える機能が変わることはありません。";

/** 書き出しに成功した直後、プレビュー欄にそっと出す一行。 */
export const SUPPORT_AFTER_EXPORT_TEXT = "楽しんでもらえたら、応援してもらえるとうれしいです。";
export const SUPPORT_AFTER_EXPORT_OFUSE_LABEL = "☕ OFUSE";
export const SUPPORT_AFTER_EXPORT_FANBOX_LABEL = "🍰 FANBOX";
