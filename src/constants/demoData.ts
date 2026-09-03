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
 * passage). The 【改ページ】 guarantees a 2nd body page exists for STEP 8's
 * export even if the user skips every optional action.
 */
export const DEMO_SEED_CONTENT = `これはおためしデモです。実際のエディターを触りながら、TateSpunの基本操作を順番に試せます。

　ここに文章を入力すると、右側のプレビュー（スマートフォンでは「プレビュー」画面）の縦書きページに、その場で反映されます。ためしに「吾輩は猫である」と入力してみましょう。

　ルビは ｜漢字《かんじ》 のように、縦中横は 12月25日 のような半角2桁で自動になります。

【改ページ】

　行のあたまに【改ページ】だけを書くと、そこから新しいページが始まります。章の始まりや場面の切り替えに使います。

　このデモで入力・変更した内容は保存されません。本棚にも残らないので、気軽に試してください。`;

export interface DemoStep {
  /** 1-based step number, matches the approved 10-step spec order. */
  n: number;
  title: string;
  /** Body copy. Kept short — one or two short sentences. */
  body: string;
  /**
   * `data-demo-target` value of the REAL control this step teaches, if any.
   * The guide scrolls it into view and rings it; it never operates it.
   */
  target?: string;
  /**
   * On phones the desktop target may not exist. This copy is shown instead of
   * (not in addition to) `body` when the layout is narrow AND `target` isn't
   * on screen — device-appropriate wording, never a fabricated control.
   */
  mobileNote?: string;
  /**
   * Non-destructive view preparation to run when the step becomes active:
   *  - "settings": switch the phone workspace to 設定 (desktop: no-op)
   *  - "editor":   switch the phone workspace to 本文
   *  - "preview":  switch the phone workspace to プレビュー
   * Never types text, never changes a setting, never downloads.
   */
  prepare?: "settings" | "editor" | "preview";
}

export const DEMO_STEPS: DemoStep[] = [
  {
    n: 1,
    title: "作品にタイトルをつけよう",
    body: "ここに入力したタイトルは、本棚の作品一覧に表示されます。",
    target: "title",
    prepare: "editor",
  },
  {
    n: 2,
    title: "本のサイズを決めよう",
    body: "ページ設定から用紙サイズを選べます。文字サイズ・余白・段組なども調整できます。",
    target: "page-settings",
    mobileNote:
      "下の「設定」画面の「ページ設定」から、用紙サイズ・文字サイズ・余白・段組を調整できます。",
    prepare: "settings",
  },
  {
    n: 3,
    title: "ノンブルや柱も設定できるよ",
    body: "本らしいページになるよう、ノンブルや柱なども細かく設定できます。",
    target: "nombre-settings",
    mobileNote:
      "「設定」画面の「ノンブル・柱」から、ページ番号やヘッダー／フッターを設定できます。",
    prepare: "settings",
  },
  {
    n: 4,
    title: "困ったらヘルプへ",
    body: "わからないことがあれば、いつでもヘルプを確認できます。開いても、このデモの進み具合は消えません。",
    target: "help",
  },
  {
    n: 5,
    title: "エディターを使いやすくしてみよう",
    body:
      "「集中モード」で設定などを隠し、本文を広く表示できます。プレビューは右側にしまわれ、いつでも開けます。パソコンでは中央の仕切りで本文とプレビューの幅を変えられます。プレビューは拡大・縮小したり、ドラッグして好きな場所へ動かせます。書きながら、完成ページがリアルタイムで変わっていきます。",
    target: "focus-mode",
    mobileNote:
      "スマートフォンでは下のバーで「本文」「プレビュー」「設定」を切り替えます。プレビューは拡大・縮小したり、ドラッグして動かせます。書きながら、完成ページがリアルタイムで変わっていきます。",
    prepare: "editor",
  },
  {
    n: 6,
    title: "実際に文章を書いてみよう",
    body:
      "本文に「吾輩は猫である」と入力してみましょう。プレビューがリアルタイムで変わります。ルビ（｜漢字《かんじ》）や【改ページ】も使えます。括弧や表記が気になるときは、文章チェックβも使えます。原稿をAIへ送らず、ブラウザ内でチェックします。",
    target: "editor",
    prepare: "editor",
  },
  {
    n: 7,
    title: "プレビューはいつでもしまえるよ",
    body: "書くことに集中したいときは、プレビューを右側にしまえます。もう一度開くのもワンタップです。",
    target: "preview-collapse",
    mobileNote:
      "スマートフォンでは、下のバーの「本文」と「プレビュー」を切り替えて使います。",
  },
  {
    n: 8,
    title: "作品を書き出してみよう",
    body:
      "プレビュー上部の「選択」で2ページ目にチェックを入れ、「書き出し」→ JPG → 書き出し設定 →「設定済みにする」→ ダウンロード、の順で書き出せます。JPGだけでなく、PDFやWeb版にも書き出せます。ダウンロードは任意です。",
    target: "export",
    prepare: "preview",
  },
  {
    n: 9,
    title: "クラウド保存について",
    body: "", // filled from auth state in DemoTour
    target: "cloud-save",
    mobileNote: "会員登録すると、作品ごとにクラウド保存を設定できます。",
  },
  {
    n: 10,
    title: "TateSpunの基本操作はこれで完了です！",
    body:
      "タイトルをつけて、本のサイズを決めて、文章を書いて、プレビューして、書き出すところまで体験できました。今度は、自分の作品を作ってみましょう。",
  },
];

export const DEMO_STEP_9_GUEST =
  "ユーザー登録すると、作品ごとにクラウド保存を設定できます。画像も扱えます。クラウド上の画像はβ版では一時保存のため、大切な原稿や画像は手元にもバックアップしておきましょう。";
export const DEMO_STEP_9_MEMBER =
  "この作品をクラウドにも保存したいときは、ヘッダーの「クラウドに保存」から設定できます。画像も扱えます。クラウド上の画像はβ版では一時保存のため、大切な原稿や画像は手元にもバックアップしておきましょう。";
