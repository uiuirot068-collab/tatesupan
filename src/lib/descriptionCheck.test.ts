import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESCRIPTION_CATEGORIES,
  DESCRIPTION_CATEGORIES,
  DESCRIPTION_CATEGORY_SUMMARIES,
  DESCRIPTION_CATEGORY_TITLES,
  DESCRIPTION_KEEP_NOTE,
  DESCRIPTION_NOT_A_JUDGEMENT_NOTE,
  analyzeDescriptionParagraph,
  describeDescriptionCategory,
  enabledDescriptionCategories,
  filterCandidatesByCategories,
  migrateDescriptionPrefs,
  toggleDescriptionCategory,
  type DescriptionCategory,
  type DescriptionCategorySet,
} from "./descriptionCheck";
import { evaluateCorpus, evaluateRow, parseCorpus } from "./descriptionCheckCorpus";

const corpusPath = resolve("typesetting-v2/qa/b5-description-check/B5_SPEC_REGRESSION_CORPUS.md");
const rows = parseCorpus(readFileSync(corpusPath, "utf8"));
const spans = (text: string) => analyzeDescriptionParagraph(text).map((c) => `${c.category}:${text.slice(c.start, c.end)}`);

describe("B5 spec / regression corpus (the human-readable table is the data)", () => {
  it("has A, B, C, 対象外 and 迷う rows in three sets (development, unseen, second unseen)", () => {
    const kinds = new Set(rows.map((row) => row.kind));
    for (const kind of ["A", "B", "C", "対象外", "迷う"]) expect(kinds.has(kind as never), `kind ${kind}`).toBe(true);
    for (const prefix of ["D-", "U-", "V-"]) expect(rows.some((row) => row.id.startsWith(prefix)), prefix).toBe(true);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length); // unique ids
  });

  const outcomes = evaluateCorpus(rows);

  it.each(outcomes.filter((o) => o.row.state === "期待" && o.passed !== null).map((o) => [o.row.id, o] as const))(
    "%s behaves as the corpus expects",
    (_id, outcome) => {
      expect(outcome.passed, `${outcome.row.id} [${outcome.row.kind}] ${outcome.row.sentence} 印「${outcome.row.mark}」 → ${outcome.found.join(" ") || "(nothing)"}`).toBe(true);
    },
  );

  it("keeps the documented limitations few and explicit (known misses are tagged, not hidden)", () => {
    const known = outcomes.filter((o) => o.row.state === "既知の取りこぼし");
    expect(known.length).toBeLessThanOrEqual(6);
    for (const o of known) expect(o.row.note.length, `${o.row.id} needs a note explaining the limitation`).toBeGreaterThan(0);
  });

  it("対象外 rows are all judged (a 対象外 mark is never silently skipped)", () => {
    for (const o of outcomes.filter((x) => x.row.kind === "対象外")) expect(o.passed).not.toBeNull();
  });

  it("evaluateRow: 迷う rows are observed, never judged", () => {
    const row = rows.find((r) => r.kind === "迷う")!;
    expect(evaluateRow(row).passed).toBeNull();
  });
});

describe("B5 independent categories (Revision 2): candidate.category ∈ enabled categories", () => {
  const sample = "昨日の夜、まるで夢のような静かな景色を、泣いている少女が笑いながら見ていた。";
  const all = analyzeDescriptionParagraph(sample);
  const set = (A: boolean, B: boolean, C: boolean): DescriptionCategorySet => ({ A, B, C });
  const cats = (list: { category: DescriptionCategory }[]) => new Set(list.map((c) => c.category));

  it("the sample really contains A, B and C candidates", () => {
    expect(cats(all)).toEqual(new Set(["A", "B", "C"]));
  });

  it("first enable = A only", () => {
    expect(DEFAULT_DESCRIPTION_CATEGORIES).toEqual({ A: true, B: false, C: false });
    expect(migrateDescriptionPrefs(undefined)).toEqual({ enabled: false, categories: { A: true, B: false, C: false } });
    expect(migrateDescriptionPrefs("garbage")).toEqual({ enabled: false, categories: { A: true, B: false, C: false } });
    expect(migrateDescriptionPrefs({ enabled: true })).toEqual({ enabled: true, categories: { A: true, B: false, C: false } });
  });

  it.each([
    [set(true, false, false), ["A"]],
    [set(false, true, false), ["B"]],
    [set(false, false, true), ["C"]],
    [set(true, true, false), ["A", "B"]],
    [set(true, false, true), ["A", "C"]],
    [set(false, true, true), ["B", "C"]],
    [set(true, true, true), ["A", "B", "C"]],
  ])("shows exactly the enabled categories %j -> %j (no staging: B is not 'A plus more')", (enabled, expected) => {
    const shown = filterCandidatesByCategories(all, enabled);
    expect(shown.length).toBeGreaterThan(0);
    expect([...cats(shown)].sort()).toEqual(expected);
    for (const candidate of shown) expect(enabled[candidate.category]).toBe(true);
    expect(enabledDescriptionCategories(enabled)).toEqual(expected);
  });

  it("zero selected categories is valid and shows nothing", () => {
    expect(filterCandidatesByCategories(all, set(false, false, false))).toEqual([]);
    expect(enabledDescriptionCategories(set(false, false, false))).toEqual([]);
  });

  it("a candidate's category never changes with the selection (filtering only hides)", () => {
    const before = all.map((c) => `${c.start}:${c.end}:${c.category}`);
    for (const enabled of [set(true, false, false), set(false, true, true), set(true, true, true)]) {
      const shown = filterCandidatesByCategories(all, enabled).map((c) => `${c.start}:${c.end}:${c.category}`);
      for (const entry of shown) expect(before).toContain(entry);
    }
  });

  it("toggling one category leaves the other two alone", () => {
    expect(toggleDescriptionCategory(set(true, false, false), "B")).toEqual(set(true, true, false));
    expect(toggleDescriptionCategory(set(true, true, true), "A")).toEqual(set(false, true, true));
    expect(toggleDescriptionCategory(set(false, false, false), "C")).toEqual(set(false, false, true));
  });

  it("migrates the first B5 build's staged mode to independent categories (A / A+B / A+B+C)", () => {
    expect(migrateDescriptionPrefs({ enabled: true, mode: "A" })).toEqual({ enabled: true, categories: set(true, false, false) });
    expect(migrateDescriptionPrefs({ enabled: true, mode: "AB" })).toEqual({ enabled: true, categories: set(true, true, false) });
    expect(migrateDescriptionPrefs({ enabled: false, mode: "ABC" })).toEqual({ enabled: false, categories: set(true, true, true) });
    expect(migrateDescriptionPrefs({ enabled: true, mode: "nonsense" })).toEqual({ enabled: true, categories: set(true, false, false) });
  });

  it("independent selections round-trip through the stored JSON (B only / A+C / none survive reload) and win over a leftover old mode", () => {
    for (const enabled of [set(false, true, false), set(true, false, true), set(false, false, false), set(false, true, true)]) {
      const stored = JSON.parse(JSON.stringify({ enabled: true, categories: enabled }));
      expect(migrateDescriptionPrefs(stored)).toEqual({ enabled: true, categories: enabled });
    }
    expect(migrateDescriptionPrefs({ enabled: true, mode: "ABC", categories: set(false, true, false) }).categories).toEqual(set(false, true, false));
    // a partly-wrong stored object never throws and never turns something on by accident
    expect(migrateDescriptionPrefs({ enabled: true, categories: { A: "yes", B: 1 } }).categories).toEqual(set(false, false, false));
  });

  it("describes each category in words (and as a text tag), never as severity or quality", () => {
    expect(DESCRIPTION_CATEGORIES).toEqual(["A", "B", "C"]);
    expect(DESCRIPTION_CATEGORY_SUMMARIES.A).toContain("直接的な説明");
    expect(DESCRIPTION_CATEGORY_SUMMARIES.B).toContain("描写的な");
    expect(DESCRIPTION_CATEGORY_SUMMARIES.C).toMatch(/時間・場所・用途/);
    expect(DESCRIPTION_CATEGORIES.map((c) => describeDescriptionCategory(c))).toEqual(["A｜直接的な説明", "B｜描写的な修飾", "C｜広い修飾"]);
    expect(Object.values(DESCRIPTION_CATEGORY_TITLES).concat(Object.values(DESCRIPTION_CATEGORY_SUMMARIES)).join("")).not.toMatch(/重大|危険|悪い|警告|優先|深刻|レベル|ランク/);
  });

  it("every candidate carries a category, a label, a reason, and a non-empty valid span", () => {
    for (const c of all) {
      expect(["A", "B", "C"]).toContain(c.category);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.reason.length).toBeGreaterThan(0);
      expect(c.end).toBeGreaterThan(c.start);
      expect(c.end).toBeLessThanOrEqual(sample.length);
    }
  });

  it("the same category never reports overlapping spans (a phrase is reported once)", () => {
    for (const category of ["A", "B", "C"] as const) {
      const list = all.filter((c) => c.category === category);
      for (let i = 1; i < list.length; i += 1) expect(list[i].start).toBeGreaterThanOrEqual(list[i - 1].end);
    }
  });
});

describe("B5 reacts to UNSEEN wording through structure, not a phrase list", () => {
  it("productive morphology fires on words that appear in no table", () => {
    // none of these words is in any table in descriptionCheck.ts: they are caught by the しい / げ / reduplication rules
    expect(spans("痛々しい傷跡が残っている。")).toContain("A:痛々しい");
    expect(spans("堅苦しい挨拶を交わした。")).toContain("A:堅苦しい");
    expect(spans("彼は妖しげな笑みを浮かべた。")).toContain("A:妖しげな");
    expect(spans("砂がざらざらと崩れた。")).toContain("A:ざらざらと");
    expect(spans("小石がぱらぱらと落ちた。")).toContain("A:ぱらぱらと");
    expect(spans("印象的な光景だった。")).toContain("A:印象的な");
    expect(spans("素朴な味わいの菓子。")).toContain("A:素朴な");
    expect(spans("殺風景な部屋に入った。")).toContain("A:殺風景な"); // generic 漢語+な+名詞 rule
    expect(spans("華々しい活躍を見せた。")).toContain("A:華々しい");
  });

  it("modifier structure (verb 連体形 + noun, simile, 〜ながら) works on arbitrary vocabulary", () => {
    expect(spans("錆びた鍵を拾った。").some((s) => s.startsWith("B:"))).toBe(true);
    expect(spans("焦げた匂いが鼻をついた。").some((s) => s.startsWith("B:"))).toBe(true);
    expect(spans("彼は羽のように軽やかに走った。").some((s) => s.startsWith("B:") && s.includes("羽のように"))).toBe(true);
    expect(spans("編みものをしながら待った。")).toContain("B:編みものをしながら");
  });

  it("does not fire on plain sentences with no modifier (false-positive guard)", () => {
    for (const plain of [
      "彼は駅に着いた。",
      "私は本を読んだ。",
      "電話が鳴った。",
      "母が台所で料理をしている。",
      "そう言って彼は立ち上がった。",
      "「ありがとう」と言った。",
    ]) {
      expect(analyzeDescriptionParagraph(plain).filter((c) => c.category === "A"), plain).toEqual([]);
    }
  });
});

describe("B5 framing: candidates are prompts, not verdicts", () => {
  it("the keep note explains that leaving the phrase can be right, and A/B/C are not quality ranks", () => {
    expect(DESCRIPTION_KEEP_NOTE).toContain("そのまま残してください");
    expect(DESCRIPTION_KEEP_NOTE).toMatch(/情景|動作|感覚|たとえ/);
    expect(DESCRIPTION_NOT_A_JUDGEMENT_NOTE).toContain("良し悪しを判定する機能ではありません");
    expect(DESCRIPTION_NOT_A_JUDGEMENT_NOTE).toContain("残してよい表現も含まれます");
    expect(DESCRIPTION_NOT_A_JUDGEMENT_NOTE).toContain("色は種類だけ");
  });

  it("no wording tells the writer to delete or fix (source scan of the analyzer + views)", () => {
    const sources = ["src/lib/descriptionCheck.ts", "src/components/DescriptionCheckControls.tsx"].map((f) => readFileSync(resolve(f), "utf8")).join("\n");
    const visible = sources.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    expect(visible).not.toMatch(/削除してください|直してください|書き直して|修正すべき|悪い文章|ダメ|NG表現/);
  });
});

describe("B5 privacy: local analysis only", () => {
  const files = [
    "src/lib/descriptionCheck.ts",
    "src/lib/descriptionCheckManuscript.ts",
    "src/lib/descriptionCheckCorpus.ts",
    "src/lib/descriptionMarkSegments.ts",
    "src/lib/descriptionCandidateNav.ts",
    "src/lib/readAloudHeldSelection.ts",
    "src/components/ReadAloudDockCard.tsx",
    "src/components/ReviewRail.tsx",
    "src/hooks/useDescriptionCheck.ts",
    "src/components/DescriptionCheckControls.tsx",
    "src/components/DescriptionMarkOverlay.tsx",
  ];
  const codeOnly = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");

  it.each(files)("%s has no fetch / XHR / beacon / WebSocket / Worker / dynamic import / external URL / AI API", (file) => {
    const code = codeOnly(readFileSync(resolve(file), "utf8"));
    expect(code).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|new Worker|import\(|https?:\/\/|openai|anthropic|gemini|api\.|kuromoji/i);
  });

  it("adds no dependency (package.json is unchanged for B5)", () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies).filter((name) => /kuromoji|mecab|sudachi|lindera|budoux|segmenter|tinyseg|wanakana/i.test(name))).toEqual([]);
  });
});
