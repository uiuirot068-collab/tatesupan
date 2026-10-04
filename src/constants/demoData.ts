import { SAMPLE_PROJECT } from "./sampleData";

/**
 * TSP-LOOP-024 —「3分でわかる TateSpun おためしデモ」.
 *
 * The demo runs the REAL editor (TategakiEditor / EditorPane / PreviewPane /
 * PageSettingsPanel …) with a disposable in-memory document. Data isolation
 * reuses the exact machinery the 使い方ガイド (SAMPLE_PROJECT) already relies
 * on — see `isEphemeralDocId` below and every call site it feeds:
 *   - no IndexedDB document row is ever written (autosave / saveNow no-op)
 *   - no cloud project / Supabase record is created
 *   - no image record is persisted
 *   - typography settings are not mirrored to localStorage
 *   - it never appears on the bookshelf
 * Nothing the user types, changes or exports during the demo survives it.
 */
export const DEMO_PROJECT = {
  /** Disposable fixed id, distinct from SAMPLE_PROJECT.id (-1). Never stored. */
  id: -2,
  title: "",
} as const;

/** True for any id whose document lives only in memory (guide + demo). */
export function isEphemeralDocId(id: number | null | undefined): boolean {
  return id === SAMPLE_PROJECT.id || id === DEMO_PROJECT.id;
}

/**
 * Deterministic demo manuscript. Short, original wording (no long copyrighted
 * passage). Paragraphs deliberately carry no pre-seeded leading whitespace:
 * the shared renderer supplies the same automatic indent as a normal new
 * project, while any space the user types remains ordinary manuscript text.
 * The 【改ページ】 guarantees a 2nd body page exists for the export step even
 * if the user skips every optional action.
 */
export const DEMO_SEED_CONTENT = `これはおためしデモです。実際のエディターを触りながら、TateSpunの基本操作を順番に試せます。

ここに文章を入力すると、右側のプレビュー（スマートフォンでは「プレビュー」画面）の縦書きページに、その場で反映されます。ためしに「吾輩は猫である」と入力してみましょう。

ルビは ｜漢字《かんじ》 のように、縦中横は 12月25日 のような半角2桁で自動になります。

【改ページ】

行のあたまに【改ページ】だけを書くと、そこから新しいページが始まります。章の始まりや場面の切り替えに使います。

このデモで入力・変更した内容は保存されません。本棚にも残らないので、気軽に試してください。`;

/**
 * SPN-XFIX-001: phones have no 「右側のプレビュー」 — the same seed with the
 * one sentence worded for the phone's 「プレビュー」 tab. Everything else
 * (paragraphs, 【改ページ】, line structure) is identical to DEMO_SEED_CONTENT.
 */
export const DEMO_SEED_CONTENT_MOBILE = DEMO_SEED_CONTENT.replace(
  "右側のプレビュー（スマートフォンでは「プレビュー」画面）の縦書きページに",
  "上の「プレビュー」を押して開く縦書きページに"
);

export interface DemoStep {
  title: string;
  /** Body copy. Kept short — one or two short sentences. */
  body: string;
  /**
   * `data-demo-target` value of the REAL control this step teaches, if any.
   * The guide scrolls it into view and rings it; it never operates it.
   */
  target?: string;
  /**
   * Raw CSS selector overriding `target` for steps that need to spotlight a
   * SPECIFIC control inside a larger `data-demo-target` surface (e.g. just
   * the 編集ページ nav row inside the editor pane, not the whole textarea).
   * Takes precedence over `target` for both scrolling/spotlighting and
   * popover placement; `target` may still be set alongside it for other
   * per-step logic (e.g. `stepBody`'s cloud-save branch) without affecting
   * which element is actually targeted.
   */
  targetSelector?: string;
  /**
   * On phones the desktop target may not exist. This copy is shown instead of
   * (not in addition to) `body` when the layout is narrow AND `target` isn't
   * on screen — device-appropriate wording, never a fabricated control.
   */
  mobileNote?: string;
  /** Optional contextual link shown under this step's explanation. */
  moreInfoHref?: string;
  moreInfoLabel?: string;
  /**
   * TSP-DEMO-001: plain-word notes for book-making words the step uses
   * (ノンブル・柱 …), shown under the body so first-time visitors are not
   * left with unexplained printing terms.
   */
  terms?: DemoTerm[];
}

export interface DemoTerm {
  word: string;
  meaning: string;
}

// TSP-DEMO-001: trimmed from 12 to 6 steps — only the path a first-time
// visitor needs (書く → 見る → 本の設定 → 本づくり → 書き出す). Title, help,
// focus mode, 編集ページ, 見直し and cloud save stay discoverable in the
// editor and in HOW TO; the last step points there.
export const DEMO_STEPS: DemoStep[] = [
  {
    title: "文章を書いてみよう",
    body:
      "本文に文章を入力すると、プレビューの縦書きページにすぐ反映されます。ルビ（｜漢字《かんじ》）や【改ページ】も使えます。",
    target: "editor",
    terms: [
      { word: "ルビ", meaning: "漢字の横に小さく添える読みがな" },
      { word: "縦中横", meaning: "縦書きの中で、数字などを横向きに並べること" },
    ],
  },
  {
    title: "プレビューで本の形を見よう",
    body: "プレビューでは、書いた文章が本のページの形で表示されます。",
    target: "preview",
    mobileNote: "上の「プレビュー」を押すと、本のページの形で確かめられます。「本文」で書く画面に戻れます。",
  },
  {
    title: "本のサイズと文字を決めよう",
    body: "「設定」で、用紙サイズ・文字の大きさ・余白・段組、ノンブルや柱を決められます。",
    target: "settings",
    terms: [
      { word: "段組", meaning: "1ページの本文を、上下2段などに分けて組むこと" },
      { word: "ノンブル", meaning: "ページ番号のこと" },
      { word: "柱", meaning: "ページの余白に小さく入れる、作品名や章の名前" },
    ],
  },
  {
    title: "表紙や目次は「本づくり」へ",
    body: "「本づくり」には、表紙・奥付・目次・完成前チェックをまとめています。",
    target: "options",
    terms: [
      { word: "奥付", meaning: "本の最後に載せる、書名・著者名・発行日などのまとめ" },
    ],
  },
  {
    title: "書き出してみよう",
    body: "プレビューの「書き出し」から、PDF・JPG（画像）で保存できます。Web閲覧用やSNS用の用紙はJPGで書き出します。デモでは保存しなくても大丈夫です。",
    target: "export",
  },
  {
    title: "基本の流れはこれでおしまいです",
    body:
      "書く、見る、整える、書き出す。これがTateSpunの流れです。わからないときは、いつでも「ヘルプ」を開けます。今度は自分の作品を作ってみましょう。",
  },
];

export const DEMO_CLOUD_SAVE_GUEST =
  "ユーザー登録すると、作品ごとにクラウド保存を設定できます。画像も扱えます。クラウド上の画像はβ版では一時保存のため、大切な原稿や画像は手元にもバックアップしておきましょう。";
export const DEMO_CLOUD_SAVE_MEMBER =
  "この作品をクラウドにも保存したいときは、ヘッダーの「クラウドに保存」から設定できます。画像も扱えます。クラウド上の画像はβ版では一時保存のため、大切な原稿や画像は手元にもバックアップしておきましょう。";
