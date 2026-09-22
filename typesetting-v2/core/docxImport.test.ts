import { describe, expect, it } from "vitest";
import { parseDocxDocumentXml } from "../../src/lib/docxImport";

const wrap = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}</w:body>
</w:document>`;

describe("DOCX import parser", () => {
  it("imports body paragraphs, entities, tabs and manual line breaks", () => {
    const xml = wrap(`
      <w:p><w:r><w:t>第一段落 &amp; 続き</w:t></w:r></w:p>
      <w:p><w:r><w:t>二段落</w:t><w:tab/><w:t>タブ後</w:t><w:br/><w:t>改行後</w:t></w:r></w:p>
    `);
    expect(parseDocxDocumentXml(xml).text).toBe("第一段落 & 続き\n二段落\tタブ後\n改行後");
  });

  it("converts Word ruby to TateSpun ruby notation", () => {
    const xml = wrap(`
      <w:p>
        <w:r><w:t>これは</w:t></w:r>
        <w:ruby>
          <w:rt><w:r><w:t>かんじ</w:t></w:r></w:rt>
          <w:rubyBase><w:r><w:t>漢字</w:t></w:r></w:rubyBase>
        </w:ruby>
        <w:r><w:t>です。</w:t></w:r>
      </w:p>
    `);
    const result = parseDocxDocumentXml(xml);
    expect(result.text).toBe("これは｜漢字《かんじ》です。");
    expect(result.stats.rubyConverted).toBe(1);
  });

  it("converts Word manual page breaks to TateSpun page-break markers", () => {
    const xml = wrap(`
      <w:p><w:r><w:t>前</w:t><w:br w:type="page"/><w:t>後</w:t></w:r></w:p>
    `);
    const result = parseDocxDocumentXml(xml);
    expect(result.text).toBe("前\n【改ページ】\n後");
    expect(result.stats.pageBreaksConverted).toBe(1);
  });

  it("drops deleted revision text and floating text-box text", () => {
    const xml = wrap(`
      <w:p>
        <w:r><w:t>残る</w:t></w:r>
        <w:del><w:r><w:delText>削除済み</w:delText></w:r></w:del>
        <w:ins><w:r><w:t>追加済み</w:t></w:r></w:ins>
      </w:p>
      <w:txbxContent><w:p><w:r><w:t>テキストボックス</w:t></w:r></w:p></w:txbxContent>
    `);
    const result = parseDocxDocumentXml(xml);
    expect(result.text).toBe("残る追加済み");
    expect(result.stats.hadTextBoxes).toBe(true);
    expect(result.stats.hadTrackedChanges).toBe(true);
  });

  it("flattens table cell paragraphs in document order and reports a table", () => {
    const xml = wrap(`
      <w:tbl>
        <w:tr>
          <w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc>
        </w:tr>
      </w:tbl>
    `);
    const result = parseDocxDocumentXml(xml);
    expect(result.text).toBe("A\nB");
    expect(result.stats.tableCount).toBe(1);
  });

  it("preserves intentional whitespace inside w:t while ignoring XML indentation", () => {
    const xml = wrap(`
      <w:p>
        <w:r><w:t>前</w:t></w:r>
        <w:r><w:t xml:space="preserve"> </w:t></w:r>
        <w:r><w:t>後</w:t></w:r>
      </w:p>
    `);
    expect(parseDocxDocumentXml(xml).text).toBe("前 後");
  });


  it("imports ordinary vertical-writing Word sections as manuscript text", () => {
    const xml = wrap(`
      <w:p><w:r><w:t>縦書き本文</w:t></w:r></w:p>
      <w:p>
        <w:ruby>
          <w:rt><w:r><w:t>かんじ</w:t></w:r></w:rt>
          <w:rubyBase><w:r><w:t>漢字</w:t></w:r></w:rubyBase>
        </w:ruby>
        <w:r><w:br w:type="page"/><w:t>改ページ後</w:t></w:r>
      </w:p>
      <w:sectPr>
        <w:textDirection w:val="tbRl"/>
        <w:docGrid w:type="lines" w:linePitch="360"/>
      </w:sectPr>
    `);
    expect(parseDocxDocumentXml(xml).text).toBe("縦書き本文\n｜漢字《かんじ》\n【改ページ】\n改ページ後");
  });

});
