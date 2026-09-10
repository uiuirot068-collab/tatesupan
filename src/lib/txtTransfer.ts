import { sanitizeFilename } from "@/utils/exportFilename";

export type TxtNewlinePolicy = "preserve" | "lf" | "crlf";

/**
 * No defaults are intentional: Product must explicitly freeze BOM and
 * newline policy before the Production UI calls this boundary.
 */
export interface TxtSerializationProfile {
  bom: boolean;
  newlines: TxtNewlinePolicy;
}

const UTF8_BOM = new Uint8Array([0xef, 0xbb, 0xbf]);

function applyNewlinePolicy(source: string, policy: TxtNewlinePolicy): string {
  if (policy === "preserve") return source;
  const lf = source.replace(/\r\n?/g, "\n");
  return policy === "crlf" ? lf.replace(/\n/g, "\r\n") : lf;
}

/**
 * Strict UTF-8 import boundary. It never fetches, uploads, tokenizes, or
 * rewrites TateSpun notation; callers choose newline policy explicitly.
 */
export function decodeUtf8Txt(
  bytes: Uint8Array,
  profile: Pick<TxtSerializationProfile, "newlines">
): string {
  const startsWithBom =
    bytes.length >= UTF8_BOM.length &&
    UTF8_BOM.every((value, index) => bytes[index] === value);
  const payload = startsWithBom ? bytes.subarray(UTF8_BOM.length) : bytes;

  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(payload);
  } catch {
    throw new Error("TXTをUTF-8として読み込めませんでした。文字コードを確認してください。");
  }
  return applyNewlinePolicy(source, profile.newlines);
}

/**
 * UTF-8 export boundary. Manuscript source is opaque: ordinary text,
 * whitespace, page-break/ruby/TCY/image markers, and future source tokens
 * all survive unless the explicitly supplied newline policy changes EOLs.
 */
export function encodeUtf8Txt(
  source: string,
  profile: TxtSerializationProfile
): Uint8Array {
  const payload = new TextEncoder().encode(applyNewlinePolicy(source, profile.newlines));
  if (!profile.bom) return payload;
  const result = new Uint8Array(UTF8_BOM.length + payload.length);
  result.set(UTF8_BOM, 0);
  result.set(payload, UTF8_BOM.length);
  return result;
}

export function buildTxtFileName(title: string): string {
  return `${sanitizeFilename(title)}.txt`;
}

/**
 * Produces a human-readable manuscript without TateSpun control notation.
 * This is deliberately a pure source transformation: Preview/DOM output is
 * never consulted, and the round-trip serialization functions above remain
 * completely unchanged.
 */
export function serializeReadableTxt(source: string): string {
  const withoutControls = source
    .replace(/\r\n?/g, "\n")
    .replace(/!\[[^\]\n]*\]\([^\)\n]*\)/g, "")
    .replace(/【IMG:[^】\n]*】/g, "")
    .replace(/【改ページ】/g, "\n\n")
    .replace(/｜([^《\n]+)《[^》\n]*》/g, "$1")
    .replace(/\[tate\]([\s\S]*?)\[\/tate\]/gi, "$1")
    .replace(/\[([^\]\n]+)\]\([^\)\n]*\)/g, "$1");

  const lines = withoutControls.split("\n").map((rawLine) => {
    let line = rawLine.replace(/[ \t]+$/g, "");
    if (line.trim() === "") return "";

    const heading = /^\s{0,3}#{1,6}\s+/.test(line);
    const list = /^\s*(?:[-+*]\s+|\d+[.)]\s+)/.test(line);
    const quote = /^\s*>\s?/.test(line);
    line = line
      .replace(/^\s{0,3}#{1,6}\s+/, "")
      .replace(/^\s*(?:[-+*]\s+|\d+[.)]\s+)/, "")
      .replace(/^\s*>\s?/, "")
      .replace(/\*\*([^*\n]+)\*\*/g, "$1")
      .replace(/__([^_\n]+)__/g, "$1")
      .replace(/\*([^*\n]+)\*/g, "$1")
      .replace(/_([^_\n]+)_/g, "$1")
      .replace(/`([^`\n]+)`/g, "$1");

    const structural = heading || list || quote || /^■\s*/.test(line);
    const alreadyIndented = /^[\s　]/.test(line);
    return structural || alreadyIndented ? line : `　${line}`;
  });

  while (lines[0] === "") lines.shift();
  while (lines.at(-1) === "") lines.pop();
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

/** Local File API only; no network boundary exists in this helper. */
export async function readLocalTxtFile(
  file: Pick<File, "arrayBuffer">,
  profile: Pick<TxtSerializationProfile, "newlines">
): Promise<string> {
  try {
    return decodeUtf8Txt(new Uint8Array(await file.arrayBuffer()), profile);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("TXTをUTF-8")) throw error;
    throw new Error("TXTファイルの読み込みに失敗しました。");
  }
}

/**
 * Local object-URL download only. The caller owns the explicit profile and
 * can surface its chosen contract before invoking this Production UI seam.
 */
export function downloadLocalTxt(
  title: string,
  source: string,
  profile: TxtSerializationProfile
): void {
  if (typeof document === "undefined") {
    throw new Error("TXTのダウンロードはブラウザでのみ利用できます。");
  }
  const blob = new Blob([encodeUtf8Txt(source, profile) as BlobPart], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = buildTxtFileName(title);
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
