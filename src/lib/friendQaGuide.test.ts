import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SAMPLE_PROJECT } from "../constants/sampleData";

describe("FRIEND QA guide-book canonical seed", () => {
  it("uses current Editor labels and removes the stale four-menu explanation", () => {
    expect(SAMPLE_PROJECT.content).toContain(
      "［▶設定］［▶オプション］［▶メモ］［▶ヘルプ］",
    );
    expect(SAMPLE_PROJECT.content).toContain(
      "［元に戻す］［やり直す］［改ページ挿入］［置換］",
    );
    expect(SAMPLE_PROJECT.content).not.toContain(
      "①ページ設定／②ノンブル・柱／③メモ／④ヘルプ",
    );
  });

  it("records the implemented colon and explicit-TCY guidance", () => {
    expect(SAMPLE_PROJECT.content).toContain(
      "全角のコロン「：」と半角のコロン「:」は、どちらも通常の文字として1文字分ずつ表示され",
    );
    expect(SAMPLE_PROJECT.content).toContain("[tate]12:30[/tate]");
  });

  it("refreshes only the reserved sample and keeps ordinary save protection intact", () => {
    const dbSource = readFileSync(join(__dirname, "db.ts"), "utf8");
    expect(dbSource).toContain(
      "doc.id === SAMPLE_PROJECT.id ? sampleDocument(doc.updatedAt) : withDefaults(doc)",
    );
    expect(dbSource).toContain(
      "if (id === SAMPLE_PROJECT.id) return sampleDocument(doc.updatedAt)",
    );
    expect(dbSource).toContain("if (isEphemeralDocId(id)) return");
  });
});
