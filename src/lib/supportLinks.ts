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

export const SUPPORT_HEADING = "SpunTalesの開発を応援する";
export const SUPPORT_BODY =
  "TateSpunを含むSpunTalesのツールは、個人で開発・運営しています。気に入っていただけたら、FANBOXやOFUSEから開発を応援していただけます。";
export const SUPPORT_FANBOX_LABEL = "FANBOXで応援する";
export const SUPPORT_OFUSE_LABEL = "OFUSEで応援する";
export const SUPPORT_NOTE = "ご支援の有無にかかわらず、TateSpunの基本機能は無料でご利用いただけます。";
