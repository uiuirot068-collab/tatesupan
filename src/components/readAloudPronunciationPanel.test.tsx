import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  READ_ALOUD_PRONUNCIATION_NEEDS_SELECTION_NOTE,
  READ_ALOUD_PRONUNCIATION_PRIVACY_NOTE,
  ReadAloudPronunciationSection,
  type ReadAloudPronunciationSectionProps,
} from "./ReadAloudPronunciationPanel";
import type { PronunciationEntry } from "@/lib/readAloudPronunciation";
import type { HeldSelection } from "@/lib/readAloudHeldSelection";

const noop = () => {};
const read = (path: string) => readFileSync(resolve(path), "utf8");
const pane = read("src/components/EditorPane.tsx");

const held: HeldSelection = { start: 0, end: 2, text: "人気", docKey: "doc" };
const entries: PronunciationEntry[] = [{ id: "a", surface: "人気", reading: "ひとけ" }];
const props = (over: Partial<ReadAloudPronunciationSectionProps> = {}): ReadAloudPronunciationSectionProps => ({
  held: null,
  entries: [],
  onUpsert: noop,
  onRemove: noop,
  ...over,
});
const render = (over: Partial<ReadAloudPronunciationSectionProps> = {}) =>
  renderToStaticMarkup(createElement(ReadAloudPronunciationSection, props(over)));

describe("B4 (Revision 3) 読みを登録: quick registration from the current selection", () => {
  it("starts collapsed: just the 音読の読みを登録 button, no form, no need-selection notice yet", () => {
    const html = render();
    expect(html).toContain("音読の読みを登録");
    expect(html).not.toContain("data-read-aloud-pronunciation-form");
    expect(html).not.toContain(READ_ALOUD_PRONUNCIATION_NEEDS_SELECTION_NOTE);
  });

  it("accepts a held selection without opening the form on its own (opening is an explicit click, never automatic)", () => {
    expect(render({ held })).toBe(render({ held: null }));
  });

  it("wires the register button and privacy line", () => {
    const source = read("src/components/ReadAloudPronunciationPanel.tsx");
    expect(source).toContain("onClick={openRegister}");
    expect(render()).toContain(READ_ALOUD_PRONUNCIATION_PRIVACY_NOTE);
  });

  it("privacy wording matches the required meaning (device-local, not sent externally) and does not claim the voice engine itself is always offline", () => {
    expect(READ_ALOUD_PRONUNCIATION_PRIVACY_NOTE).toContain("この端末のブラウザに保存");
    expect(READ_ALOUD_PRONUNCIATION_PRIVACY_NOTE).toContain("外部サービスへ送信しません");
    expect(READ_ALOUD_PRONUNCIATION_PRIVACY_NOTE).not.toMatch(/常に|必ず.*オフライン/);
  });
});

describe("B4 読みを登録: form behaviour", () => {
  it("with a held selection, 表記 is pre-filled read-only from it and the reading field is empty", () => {
    const source = read("src/components/ReadAloudPronunciationPanel.tsx");
    expect(source).toContain("data-read-aloud-pronunciation-surface");
    expect(source).toContain("held.text");
  });

  it("save is disabled for an invalid or empty reading; a validity message appears once something invalid is typed", () => {
    const source = read("src/components/ReadAloudPronunciationPanel.tsx");
    expect(source).toContain("disabled={!readingValid}");
    expect(source).toContain("isValidPronunciationReading(readingDraft)");
    expect(source).toContain("読みはひらがな・カタカナで入力してください。");
  });

  it("saving calls onUpsert with the held selection's text and the typed reading", () => {
    const source = read("src/components/ReadAloudPronunciationPanel.tsx");
    expect(source).toContain("onUpsert(held.text, readingDraft)");
  });

  it("without a selection, opening the register action explains one is needed instead of showing a form", () => {
    expect(READ_ALOUD_PRONUNCIATION_NEEDS_SELECTION_NOTE).toContain("選んでください");
    const source = read("src/components/ReadAloudPronunciationPanel.tsx");
    expect(source).toContain(": !held ? (");
  });
});

describe("B4 読みを登録: management (list / edit / delete)", () => {
  it("shows nothing when there are no entries yet", () => {
    expect(render({ entries: [] })).not.toContain("data-read-aloud-pronunciation-list");
  });

  it("lists every registered surface → reading pair with its count", () => {
    const html = render({ entries: [...entries, { id: "b", surface: "大分", reading: "おおいた" }] });
    expect(html).toContain("登録した読み（2件）");
    expect(html).toContain("人気");
    expect(html).toContain("ひとけ");
    expect(html).toContain("大分");
    expect(html).toContain("おおいた");
  });

  it("each row offers 編集 and 削除, wired to the id", () => {
    const html = render({ entries });
    expect(html).toContain('data-read-aloud-pronunciation-item="a"');
    expect(html).toContain("data-read-aloud-pronunciation-edit");
    expect(html).toContain("data-read-aloud-pronunciation-remove");
    const source = read("src/components/ReadAloudPronunciationPanel.tsx");
    expect(source).toContain("onClick={() => onRemove(entry.id)}");
    expect(source).toContain("onClick={() => startEdit(entry)}");
    expect(source).toContain("onUpsert(surface, editDraft)"); // edit reuses upsert on the same surface, never renames it
  });

  it("editing validates the new reading the same way as registration", () => {
    const source = read("src/components/ReadAloudPronunciationPanel.tsx");
    expect(source).toContain("disabled={!isValidPronunciationReading(editDraft)}");
  });

  it("does not overbuild: no import/export UI, no cloud sync, no per-project dictionary, no regex entries", () => {
    const source = read("src/components/ReadAloudPronunciationPanel.tsx") + read("src/hooks/useReadAloudPronunciation.ts");
    expect(source).not.toMatch(/エクスポート|インポート|同期|クラウド|supabase|正規表現|RegExp\(/i);
  });
});

describe("B4 読みを登録: wiring into EditorPane / the priority chain", () => {
  it("the Hub's 音読β section includes the pronunciation panel, fed the same held selection B4 already tracks", () => {
    expect(pane).toContain("<ReadAloudPronunciationSection");
    expect(pane).toContain("held={held}");
    expect(pane).toContain("entries={pronunciation.entries}");
    expect(pane).toContain("onUpsert={pronunciation.upsertEntry}");
    expect(pane).toContain("onRemove={pronunciation.removeEntry}");
  });

  it("the dictionary is threaded into what B4 actually speaks (getReadAloudSource), on both editor surfaces", () => {
    expect(pane).toContain("pronunciation: pronunciation.entries");
    expect(pane.match(/pronunciation: pronunciation\.entries/g)).toHaveLength(2); // WINDOWED + legacy textarea branches
  });

  it("the hook is browser-local only (createJsonLocalStorageHook, versioned key) -- same model as the existing わたしの辞書", () => {
    const hook = read("src/hooks/useReadAloudPronunciation.ts");
    expect(hook).toContain("tatespun.readAloudPronunciation.v1");
    expect(hook).toContain("createJsonLocalStorageHook");
  });
});

describe("B4 読みを登録 / dictionary: not part of the manuscript, exports or the B3 feedback payload", () => {
  it("no export or Preview module references the pronunciation dictionary", () => {
    for (const file of ["src/components/PreviewPane.tsx", "src/components/PageCard.tsx", "src/utils/exportCapture.ts", "src/lib/v2BrowserExport.ts", "src/lib/txtTransfer.ts"]) {
      expect(read(file), file).not.toMatch(/readAloudPronunciation|PronunciationEntry/);
    }
  });

  it("no B3 feedback module references it", () => {
    expect(read("src/lib/reviewHubFeedback.ts")).not.toMatch(/readAloudPronunciation|PronunciationEntry|pronunciation/i);
  });

  it("does not mutate the manuscript: EditorPane never calls onContentChange from the pronunciation hook/panel", () => {
    const source = read("src/hooks/useReadAloudPronunciation.ts") + read("src/components/ReadAloudPronunciationPanel.tsx");
    expect(source).not.toMatch(/onContentChange|setContent/);
  });
});
