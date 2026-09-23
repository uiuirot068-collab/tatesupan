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
}

export const DEMO_STEPS: DemoStep[] = [
  {
    title: "作品にタイトルをつけよう",
    body: "ここに入力したタイトルは、本棚の作品一覧に表示されます。",
    target: "title",
  },
  {
    title: "本のサイズを決めよう",
    body: "ページ設定から用紙サイズを選べます。文字サイズ・余白・段組なども調整できます。",
    target: "settings",
    mobileNote:
      "下の「設定」画面の「ページ設定」から、用紙サイズ・文字サイズ・余白・段組を調整できます。",
  },
  {
    title: "ノンブルや柱も設定できるよ",
    body: "本らしいページになるよう、ノンブルや柱なども細かく設定できます。",
    target: "settings",
    mobileNote:
      "「設定」画面の「ノンブル・柱」から、ページ番号やヘッダー／フッターを設定できます。",
  },
  {
    title: "オプションも使えます",
    body:
      "オプションには、奥付（縦・横）、目次、完成前チェック、TXT出入力をまとめています。必要な機能をここから選べます。",
    target: "options",
  },
  {
    title: "困ったらヘルプへ",
    body:
      "わからないことがあれば、いつでもヘルプを確認できます。開いても、このデモの進み具合は消えません。TateSpunで使える機能をまとめて知りたいときは、HOW TOで詳しい説明を確認できます。",
    target: "help",
    moreInfoHref: "/howto",
    moreInfoLabel: "HOW TOで機能を見る ↗",
  },
  {
    title: "集中モードで本文を広く",
    body:
      "「集中モード」で不要な情報を隠し、本文の編集領域を広くできます。通常表示へいつでも戻せます。",
    target: "focus-mode",
    mobileNote:
      "スマートフォンでは「本文」と「プレビュー」を切り替えられます。「集中モード」なら不要な情報を隠して本文を広くでき、通常表示へいつでも戻せます。",
  },
  {
    title: "実際に文章を書いてみよう",
    body:
      "本文に「吾輩は猫である」と入力してみましょう。プレビューがリアルタイムで変わります。ルビ（｜漢字《かんじ》）や【改ページ】も使えます。括弧や表記が気になるときは、文章チェックβも使えます。原稿をAIへ送らず、ブラウザ内でチェックします。",
    target: "editor",
  },
  {
    // TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §G: describes the paged
    // long-document editor surface (NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE=WINDOWED).
    // Kept as a general "did you know" step even when the default FULL
    // surface is active (the demo manuscript is far too short to ever
    // split into more than one 編集ページ either way) -- copy matches the
    // ACTUAL implemented Preview interaction (⋮ メニュー →「編集位置へ移動」),
    // never a direct page-click, which isn't implemented.
    title: "長い原稿は「編集ページ」で軽やかに",
    body:
      "長い原稿は、快適に編集できるよう適度な長さで編集ページに分かれます。「ここで区切る」で好きな位置に分けたり、「前のページとつなぐ」で戻したりできます。編集ページは作業用の区切りなので、原稿そのものやプレビュー・PDF・JPGのページには影響しません。",
    // TSP-PAGED-EDITOR-PREVIEW-SYNC-STABILITY-011 §G: spotlight just the
    // ←編集ページN/M→ 全文を選択 ここで区切る nav row (PagedEditor.tsx's own
    // `data-editor-page-navigator` hook), not the whole editor textarea --
    // that row is a thin strip near the top of the pane, so a below-target
    // popover placement no longer has to fight the full-height editor rect
    // for room. Absent entirely on the (default) non-paged editor surface,
    // in which case this step falls back to the ordinary floating placement
    // like any other targetless step.
    targetSelector: "[data-editor-page-navigator]",
  },
  {
    title: "「見直し」で原稿をチェックしよう",
    body:
      "「見直し」を押すと、文章チェックβ・作業カウンター・音読β・描写語・修飾表現チェックβなど、原稿を見直すための機能がまとまって開きます。フッターに表示する機能は最大2つまで選べます。",
    targetSelector: "[data-editor-review-hub-trigger]",
  },
  {
    title: "作品を書き出してみよう",
    body:
      "プレビュー上部の「選択」で2ページ目にチェックを入れ、「書き出し」→ JPG → 書き出し設定 →「設定済みにする」→ ダウンロード、の順で書き出せます。JPGだけでなく、PDFやWeb版にも書き出せます。ダウンロードは任意です。",
    target: "export",
  },
  {
    title: "クラウド保存について",
    body: "", // filled from auth state in DemoTour
    target: "cloud-save",
    mobileNote: "会員登録すると、作品ごとにクラウド保存を設定できます。",
  },
  {
    title: "TateSpunの基本操作はこれで完了です！",
    body:
      "タイトルをつけて、本のサイズを決めて、文章を書いて、プレビューして、書き出すところまで体験できました。今度は、自分の作品を作ってみましょう。",
  },
];

export const DEMO_CLOUD_SAVE_GUEST =
  "ユーザー登録すると、作品ごとにクラウド保存を設定できます。画像も扱えます。クラウド上の画像はβ版では一時保存のため、大切な原稿や画像は手元にもバックアップしておきましょう。";
export const DEMO_CLOUD_SAVE_MEMBER =
  "この作品をクラウドにも保存したいときは、ヘッダーの「クラウドに保存」から設定できます。画像も扱えます。クラウド上の画像はβ版では一時保存のため、大切な原稿や画像は手元にもバックアップしておきましょう。";
