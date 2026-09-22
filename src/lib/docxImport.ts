import JSZip from "jszip";

export interface DocxImportStats {
  paragraphCount: number;
  rubyConverted: number;
  pageBreaksConverted: number;
  tableCount: number;
  hadTextBoxes: boolean;
  hadTrackedChanges: boolean;
}

export interface DocxImportResult {
  text: string;
  notices: string[];
  stats: DocxImportStats;
}

const XML_TEXT_RE = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
const PARAGRAPH_RE = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
const RUBY_RE = /<w:ruby\b[^>]*>([\s\S]*?)<\/w:ruby>/g;

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function collectWordText(fragment: string): string {
  let text = "";
  for (const match of fragment.matchAll(XML_TEXT_RE)) {
    text += decodeXml(match[1] ?? "");
  }
  return text;
}

function renderParagraph(fragment: string, stats: DocxImportStats): string {
  let work = fragment;

  // Deleted/moved-away revision text should not reappear in the imported current manuscript.
  work = work
    .replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g, "")
    .replace(/<w:moveFrom\b[^>]*>[\s\S]*?<\/w:moveFrom>/g, "");

  // Replace Word ruby with temporary text tokens so the document-order scanner below
  // sees each ruby exactly once. This avoids reading both rubyBase and rt separately.
  const rubyValues: string[] = [];
  work = work.replace(/<w:ruby\b[^>]*>([\s\S]*?)<\/w:ruby>/g, (_whole, rubyBody: string) => {
    const readingMatch = rubyBody.match(/<w:rt\b[^>]*>([\s\S]*?)<\/w:rt>/);
    const baseMatch = rubyBody.match(/<w:rubyBase\b[^>]*>([\s\S]*?)<\/w:rubyBase>/);
    const reading = readingMatch ? collectWordText(readingMatch[1]) : "";
    const base = baseMatch ? collectWordText(baseMatch[1]) : "";
    const value = base && reading ? `｜${base}《${reading}》` : base || reading;
    if (base && reading) stats.rubyConverted += 1;
    const index = rubyValues.push(value) - 1;
    return `<w:t>\uE000TSP_RUBY_${index}\uE001</w:t>`;
  });

  // Read only Word text/control elements. XML indentation between tags is ignored,
  // while whitespace inside <w:t> is preserved (including xml:space="preserve").
  const tokenRe =
    /<w:t\b[^>]*>[\s\S]*?<\/w:t>|<w:tab\b[^>]*(?:\/>|><\/w:tab>)|<w:br\b[^>]*(?:\/>|><\/w:br>)|<w:cr\b[^>]*(?:\/>|><\/w:cr>)/g;

  let text = "";
  for (const match of work.matchAll(tokenRe)) {
    const token = match[0];

    if (token.startsWith("<w:t>") || token.startsWith("<w:t ")) {
      const textMatch = token.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/);
      let value = decodeXml(textMatch?.[1] ?? "");
      value = value.replace(/\uE000TSP_RUBY_(\d+)\uE001/g, (_marker, indexText: string) => {
        const index = Number.parseInt(indexText, 10);
        return rubyValues[index] ?? "";
      });
      text += value;
      continue;
    }

    if (token.startsWith("<w:tab")) {
      text += "\t";
      continue;
    }

    if (token.startsWith("<w:cr")) {
      text += "\n";
      continue;
    }

    if (/\bw:type=(?:"page"|'page')/.test(token)) {
      stats.pageBreaksConverted += 1;
      text += "\n【改ページ】\n";
    } else {
      text += "\n";
    }
  }

  return text;
}
export function parseDocxDocumentXml(xml: string): { text: string; stats: DocxImportStats } {
  const stats: DocxImportStats = {
    paragraphCount: 0,
    rubyConverted: 0,
    pageBreaksConverted: 0,
    tableCount: (xml.match(/<w:tbl\b/g) ?? []).length,
    hadTextBoxes: /<w:txbxContent\b/.test(xml),
    hadTrackedChanges: /<w:(?:ins|del|moveFrom|moveTo)\b/.test(xml),
  };

  const bodyXml = xml.replace(/<w:txbxContent\b[^>]*>[\s\S]*?<\/w:txbxContent>/g, "");

  const paragraphs: string[] = [];
  for (const match of bodyXml.matchAll(PARAGRAPH_RE)) {
    stats.paragraphCount += 1;
    paragraphs.push(renderParagraph(match[1] ?? "", stats));
  }

  const text = paragraphs.join("\n").replace(/\r\n?/g, "\n").replace(/\n+$/g, "");
  return { text, stats };
}

export async function readDocxFile(file: File): Promise<DocxImportResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error("DOCXを読み込めませんでした。破損・暗号化・パスワード保護されたファイルには対応していません。");
  }

  const documentEntry = zip.file("word/document.xml");
  if (!documentEntry) {
    throw new Error("DOCX本文を見つけられませんでした。Wordの .docx ファイルを選択してください。");
  }

  const xml = await documentEntry.async("text");
  const parsed = parseDocxDocumentXml(xml);

  if (parsed.text.trim().length === 0) {
    throw new Error("DOCXから本文を読み取れませんでした。本文がある .docx ファイルか確認してください。");
  }

  const notices: string[] = [];
  if (zip.file(/^word\/media\//).length > 0) notices.push("画像は取り込まれません");
  if (parsed.stats.tableCount > 0) notices.push("表はセル構造を保持せず文字だけ順番に取り込みます");
  if (parsed.stats.hadTextBoxes) notices.push("テキストボックスは取り込まれません");
  if (zip.file("word/footnotes.xml") || zip.file("word/endnotes.xml")) notices.push("脚注・文末脚注は取り込まれません");
  if (zip.file("word/comments.xml")) notices.push("コメントは取り込まれません");
  if (parsed.stats.hadTrackedChanges) notices.push("変更履歴の削除済み文字は除外し、現在残る本文を取り込みます");

  return { text: parsed.text, notices, stats: parsed.stats };
}
