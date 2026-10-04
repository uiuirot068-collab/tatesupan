import type { PageSettings } from "@/lib/pageLayout";

/**
 * SPN-XFIX-002: 「SNS用 4:5」の下に入れるクレジット（ロゴ・TateSpun・URL・本人のSNSのID）。
 * 「SNS用 正方形」はクレジットなしで使いたい人のために、何も入れない。
 */
export const SNS_CREDIT_PAPER = "SNS用 4:5";
export const SNS_CREDIT_URL = "spuntales.net/tatespun/";
export const SNS_ID_MAX_LENGTH = 40;
const LAST_SNS_ID_KEY = "tatespun_last_sns_id_v1";

/** その作品の4:5の下にクレジットを入れるか（未設定＝入れる）。 */
export function showsSnsCredit(settings: Pick<PageSettings, "paperSize" | "snsCredit">): boolean {
  return settings.paperSize === SNS_CREDIT_PAPER && settings.snsCredit !== false;
}

/**
 * 入力されたIDを、画像に入れる形にそろえる。
 * 前後の空白は取り、@ がなく「.」も含まない（X・Instagram などの）IDには @ を付ける。
 * Bluesky のような「名前.bsky.social」は、そのまま入れる。
 */
export function formatSnsId(raw: string | undefined | null): string {
  const id = String(raw ?? "").replace(/\s+/g, "").slice(0, SNS_ID_MAX_LENGTH);
  if (!id) return "";
  if (id.startsWith("@") || id.includes(".")) return id;
  return "@" + id;
}

/** 最後に入れたID（新しい作品にも最初から入るように、この端末にだけ残す）。 */
export function lastSnsId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(LAST_SNS_ID_KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberSnsId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_SNS_ID_KEY, id);
  } catch {
    /* 保存できない環境でも、作品の設定には残る */
  }
}

/** 画像に入れるID。作品に入れたIDがなければ、最後に入れたIDを使う。 */
export function resolveSnsId(settings: Pick<PageSettings, "snsId">): string {
  return formatSnsId(settings.snsId !== undefined ? settings.snsId : lastSnsId());
}
