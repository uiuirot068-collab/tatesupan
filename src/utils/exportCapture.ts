'use client';

import { toCanvas, getFontEmbedCSS } from 'html-to-image';

/**
 * 計測ログの有効フラグ（開発時のみ）。exportImage.ts/exportPdf.tsの
 * ページ単位console.groupCollapsedと合わせるため共有export。production
 * ビルドではconsole出力自体を行わず、挙動・画質には一切影響しない。
 */
export const EXPORT_TIMING_ENABLED = process.env.NODE_ENV !== 'production';

/**
 * `pageElementsRef` in PreviewPane registers the wrapper div around each
 * `PageCard` (which also holds the editor-only toolbar row and the
 * "N ページ" label), not the `.page-card`/`[data-page-card]` element itself.
 * Exporting that wrapper verbatim pulls that editor chrome into the
 * captured image. `capturePageToCanvas` below resolves down to it first —
 * the toolbar row and page-number label are siblings of `.page-card`, not
 * descendants, so this excludes them without touching PageCard.tsx.
 */
export function resolvePageCardElement(root: HTMLElement): HTMLElement {
  if (root.matches('.page-card, [data-page-card]')) return root;
  return root.querySelector<HTMLElement>('.page-card, [data-page-card]') ?? root;
}

export interface CapturePageOptions {
  /** Output canvas resolution multiplier relative to the captured page's canonical CSS px size. */
  pixelRatio: number;
}

/**
 * Measures the canonical CSS px size `capturePageToCanvas` below will
 * actually rasterize `root` at (before `pixelRatio` is applied) — the same
 * `.page-card`-resolution and clientWidth/offsetWidth-vs-isPx distinction it
 * uses internally, exposed so callers can size a target pixelRatio (e.g. the
 * print-JPG "long side = 1600px" spec, see `computePrintJpgPixelRatio` in
 * pageLayout.ts) against the *actual* capture surface instead of an
 * independently recomputed mm→px estimate that could drift from it.
 */
export function measureCaptureSize(root: HTMLElement): { width: number; height: number } {
  const target = resolvePageCardElement(root);
  const isPxPage = target.dataset.isPxPage === "true";
  return {
    width: isPxPage ? target.offsetWidth : target.clientWidth,
    height: isPxPage ? target.offsetHeight : target.clientHeight,
  };
}

/** [0,1]区間の比率で表した矩形。基準となる要素の canonical width/height に対する割合。 */
export interface RelativeRect {
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
}

/**
 * TrimGuide（仕上がり線, `[data-bleed-guide="true"]`。PageCard.tsx）の
 * 現在の描画位置を、`.page-card`自身の canonical width/height に対する
 * 比率として返す。印刷用紙JPGのcropは「3mmという理論値」から逆算する
 * のではなく、この実測比率をそのままcapture後のcanvasへ適用する——
 * `.page-card`のborder有無・box-sizing・`marginTop: auto`など、
 * どんな見た目上のズレ要因があっても、TrimGuideとcanvasはどちらも
 * 同じ`.page-card`のcanonical widthを分母にした比率なので自動的に
 * 追従する。
 *
 * `getBoundingClientRect()`は現在の画面上のzoom/fit `transform`が
 * 掛かった状態で測っても構わない——分子・分母が同じ倍率で伸縮するため
 * 比率自体は不変（scale-invariant）。ただし`.page-card`自身の外側の
 * `margin`（`marginTop: auto`等）はこの2つの矩形どちらの内部にも
 * 影響しないため、この比率算出には無関係——実際にcaptureされる
 * canvasの中身がその margin の影響を受けないようにするのは
 * capturePageToCanvas側の役目（style overrideで`marginTop: '0'`を
 * 強制している）。
 *
 * TrimGuideが存在しない（Web閲覧用、または想定外のタイミング）場合は
 * nullを返す——呼び出し側は「cropしない」等の安全側へfallbackすること。
 */
export function measureTrimGuideRatioRect(root: HTMLElement): RelativeRect | null {
  const target = resolvePageCardElement(root);
  const guide = target.querySelector<HTMLElement>('[data-bleed-guide="true"]');
  if (!guide) return null;

  const pageRect = target.getBoundingClientRect();
  const guideRect = guide.getBoundingClientRect();
  if (pageRect.width === 0 || pageRect.height === 0) return null;

  return {
    xRatio: (guideRect.left - pageRect.left) / pageRect.width,
    yRatio: (guideRect.top - pageRect.top) / pageRect.height,
    widthRatio: guideRect.width / pageRect.width,
    heightRatio: guideRect.height / pageRect.height,
  };
}

let cachedFontEmbedCssKey: string | null = null;
let cachedFontEmbedCssPromise: Promise<string> | null = null;

/**
 * html-to-imageは`fontEmbedCSS`を渡さない限り、`toCanvas`呼び出しごとに
 * （＝1ページcaptureごとに）Google Fontsの埋め込みCSSを毎回ゼロから
 * 解決し直す（getWebFontCSS内部）。TateSpunのGoogle Fonts読み込み
 * （layout.tsxの`<link rel="stylesheet" href="https://fonts.googleapis.com/...">`）
 * はクロスオリジンのため`sheet.cssRules`の同期読み取りがSecurityErrorに
 * なり、html-to-image側はconsole.errorを出しつつ`fetch(sheet.href)`で
 * CSS全文を取り直し、そこに列挙された各フォントファイルを毎回
 * fetch+base64化する——これが1ページ20〜30秒かかる主因。この結果
 * （`getFontEmbedCSS()`の戻り値）を1度だけ計算してmodule-scopeで
 * キャッシュし、以後の`toCanvas`へ`fontEmbedCSS`optionとして渡すことで
 * 2回目以降のcaptureからこの経路を丸ごとskipする（html-to-image公式が
 * 推奨する使い方、types.d.tsの`fontEmbedCSS`オプション説明を参照）。
 *
 * 参照nodeに`document.body`を使うのは、特定の1ページ（`target`）だけを
 * 渡すと、そのページがたまたま柱/ノンブル/フッターを非表示にしていた
 * 場合、それらが常時使う固定フォント（Shippori Mincho, 後述）が
 * 見つからず埋め込みから漏れる可能性があるため——`document.body`は
 * 現在マウント中の全ページを含むので、文書全体で実際に使われている
 * フォントを一度で漏れなく拾える。
 *
 * キャッシュキーには、本文フォント（PageSettings.fontFamily。柱/
 * ノンブル/フッターは常にShippori Mincho固定でこの値に連動しない）が
 * 実際にDOMへ反映された値——`.tategaki-line`要素の computed
 * font-family——を使う。設定画面で本文フォントが変更されればこの値も
 * 変わるため、古いフォントのままキャッシュを使い続けることはない。
 * 該当要素が1つも無い（全ページが挿絵のみ等）場合はキー未検出として
 * 扱い、そのタイミングでは毎回再計算する（古い書体を誤って使うより
 * 安全側に倒す）。
 */
async function getCachedFontEmbedCss(): Promise<string> {
  const sample = document.querySelector<HTMLElement>('.tategaki-line');
  const key = sample ? window.getComputedStyle(sample).fontFamily : null;
  if (key === null || cachedFontEmbedCssPromise === null || cachedFontEmbedCssKey !== key) {
    cachedFontEmbedCssKey = key;
    cachedFontEmbedCssPromise = getFontEmbedCSS(document.body);
  }
  return cachedFontEmbedCssPromise;
}

/**
 * ユーザーが実際にexportを押す前に、上記のfontEmbedCSSキャッシュを
 * バックグラウンドで温めておくための呼び出し口。`getCachedFontEmbedCss`
 * が保持するPromiseキャッシュそのものを起動するだけで、別のキャッシュは
 * 一切作らない——`cachedFontEmbedCssPromise`はモジュールスコープの単一
 * 変数なので、この呼び出しでまだpending中のPromiseを、後から
 * `capturePageToCanvas`側の`getCachedFontEmbedCss()`呼び出しがそのまま
 * 共有してawaitする（キー一致判定により二重生成は起きない）。
 *
 * 呼び出し元（PreviewPaneのeffect）の描画・ユーザー操作を一切
 * blockしないよう、この関数自体は同期的に即returnする——内部の
 * Promiseはvoidで無視し、失敗時もconsole警告のみに留める（呼び出し元へ
 * 例外を伝播させない）。
 */
export function prewarmExportFonts(): void {
  const tStart = performance.now();
  if (EXPORT_TIMING_ENABLED) console.log('[export font prewarm] start');
  void getCachedFontEmbedCss()
    .then(() => {
      if (EXPORT_TIMING_ENABLED) {
        console.log(`[export font prewarm] ready ${(performance.now() - tStart).toFixed(0)} ms`);
      }
    })
    .catch((err) => {
      console.warn('[export font prewarm] failed', err);
    });
}

/**
 * Shared capture entry point used by JPG/ZIP/PDF export alike (see
 * exportImage.ts / exportPdf.ts) so all three formats rasterize the same
 * page the same way.
 *
 * This used to go through html2canvas, which reimplements CSS box/text
 * layout in JS rather than using the browser's real renderer — it has no
 * real support for `writing-mode: vertical-rl`, which is exactly why
 * tategaki body text came out scattered/collapsed in JPG/ZIP/PDF while the
 * live preview (real browser layout) stayed correct. html-to-image instead
 * serializes the target's *computed* styles into an SVG `<foreignObject>`
 * and lets the browser itself rasterize that via an `<img>` load — the same
 * rendering engine that already draws the (correct) on-screen preview, so
 * vertical-rl, ruby, oklch colors, image object-fit, etc. all come from real
 * browser behavior instead of a reimplementation that has to be individually
 * patched for each CSS feature it doesn't support.
 */
export async function capturePageToCanvas(
  root: HTMLElement,
  { pixelRatio }: CapturePageOptions
): Promise<HTMLCanvasElement> {
  const tStart = performance.now();
  const target = resolvePageCardElement(root);
  const tResolved = performance.now();

  // PreviewPane applies a responsive `transform: scale(...)` (mobile
  // auto-fit / manual zoom / fit-to-pane presentation scale, see
  // PreviewPane.tsx's `autoFitScale`) several ancestors up, on the
  // `[data-export-scale-root]` wrapper. Unlike html2canvas's clone-then-fix
  // approach, html-to-image renders the *live* node's current on-screen
  // geometry, so that presentation-only transform must be neutralized on
  // the real DOM for the moment of capture (and restored right after) —
  // otherwise the exported canvas would reflect whatever zoom level the
  // editor happened to be showing instead of the page's true canonical
  // size. The brief flicker this causes is limited to an explicit export
  // action.
  const scaleRoot = target.closest<HTMLElement>('[data-export-scale-root]');
  const previousTransform = scaleRoot?.style.transform ?? '';
  const previousTransition = scaleRoot?.style.transition ?? '';
  if (scaleRoot) {
    scaleRoot.style.setProperty('transform', 'none');
    scaleRoot.style.setProperty('transition', 'none');
  }

  let tFontsReady = tResolved;
  let tMeasured = tResolved;
  let tFontEmbedReady = tResolved;
  let tCaptured = tResolved;

  try {
    // Rasterizing mid-swap (e.g. before a webfont like Shippori Mincho has
    // finished loading) would bake in the fallback face instead of the
    // intended one.
    await document.fonts.ready;
    tFontsReady = performance.now();

    // See measureCaptureSize's own doc for the clientWidth-vs-offsetWidth
    // (border-inclusion) distinction this makes for isPx pages.
    const { width, height } = measureCaptureSize(target);
    tMeasured = performance.now();

    // 2回目以降のcaptureをGoogle Fontsの毎回re-fetch/re-embedから解放する
    // ためのキャッシュ済みfontEmbedCSS。getCachedFontEmbedCssの doc 参照。
    const fontEmbedCSS = await getCachedFontEmbedCss();
    tFontEmbedReady = performance.now();

    const canvas = await toCanvas(target, {
      pixelRatio,
      width,
      height,
      backgroundColor: '#ffffff',
      cacheBust: true,
      fontEmbedCSS,
      // Excludes editor-only chrome that can appear *inside* `.page-card`
      // (currently just the print-only trim/bleed guide, `[data-bleed-guide]`
      // — checkboxes/toolbar/page-number label are siblings of `.page-card`,
      // already excluded by resolvePageCardElement above). `node` can be a
      // non-Element (e.g. a text node) at runtime despite the declared
      // HTMLElement type, so guard with `instanceof Element` before calling
      // `.matches`.
      filter: (node) =>
        !(node instanceof Element) ||
        !node.matches('.no-print, [data-no-print], [data-bleed-guide]'),
      // Root-only overrides: PageCard.tsx always applies a 1px Tailwind
      // `border` to `.page-card` (gray normally, `border-accent`/`ring-2
      // ring-accent` — a warm-gold accent color — when selected), plus a
      // drop-shadow. All of that is purely editor chrome and must never
      // appear in an export. Recoloring the border (e.g. to a neutral gray)
      // is not enough — a border is still painted, so the gold/gray ring
      // survives either way. `border: 'none'` removes the border entirely
      // instead. This is safe dimensionally: `applyStyle` (html-to-image)
      // re-pins the clone's own `width`/`height` to this call's `width`/
      // `height` options *after* cloning, overriding whatever numeric value
      // `.page-card`'s own computed style carried over — so the clone's
      // outer (border-box) size stays exactly what capturePageToCanvas
      // measured either way; removing the border only changes how much of
      // that already-fixed box is *content* vs *border paint*, not the
      // box's own size. That in turn is also why `.page-card`'s full-page
      // 挿絵 (FullPageImage, `position: absolute; inset: 0`) used to leave
      // a ~1px white gap at every edge: `inset: 0` resolves against the
      // *padding box* of its `position: relative` ancestor (`.page-card`),
      // which excludes the border — with the border gone, the padding box
      // grows to fill the entire (unchanged) outer box, so the image now
      // covers it edge-to-edge with no separate fix needed. Tailwind's
      // `ring-*` utilities composite into `box-shadow`, so boxShadow/outline
      // are still cleared for the drop-shadow/selection ring. The background
      // override forces a pure white page (no off-white/cream `bg-paper`
      // tint) independent of theme.
      // `.page-card` itself carries an inline `marginTop: "auto"` (see
      // PageCard.tsx) that a live spread row resolves to a concrete px value
      // whenever this page's sibling in the same 見開き has a taller
      // toolbar/挿絵-panel above it — a live-layout-alignment artifact of
      // being rendered next to another page, with nothing to do with this
      // page's own content. html-to-image's clone step copies computed
      // style (including that resolved `margin-top: Npx`) onto the CLONE,
      // which is then rendered alone inside a fixed-size foreignObject
      // (sized to exactly this page's own canonical width/height, with no
      // extra room reserved for a margin) — so a nonzero margin-top pushes
      // the page's own content down by N px *inside that fixed box*,
      // silently clipping N px off its own bottom edge and leaving an N px
      // gap that reads as extra top margin. Forcing it to 0 for the export
      // only (the live preview's own alignment is untouched) removes that
      // artifact so the captured content starts exactly at the page's own
      // top, matching what TrimGuide (measured independently, see
      // measureTrimGuideRatioRect below) actually shows on screen.
      style: {
        boxShadow: 'none',
        outline: 'none',
        border: 'none',
        marginTop: '0',
        backgroundColor: '#ffffff',
        background: '#ffffff',
      },
    });
    tCaptured = performance.now();
    return canvas;
  } finally {
    if (scaleRoot) {
      scaleRoot.style.transform = previousTransform;
      scaleRoot.style.transition = previousTransition;
    }
    if (EXPORT_TIMING_ENABLED) {
      const tEnd = performance.now();
      // 実行順は「resolve → document.fonts.ready → measure →
      // fontEmbedCSS準備 → toCanvas → transform復元」——計測のために
      // この順序自体は変更していない。
      console.log(`resolve element: ${(tResolved - tStart).toFixed(1)} ms`);
      console.log(`font preparation (document.fonts.ready): ${(tFontsReady - tResolved).toFixed(1)} ms`);
      console.log(`measure: ${(tMeasured - tFontsReady).toFixed(1)} ms`);
      console.log(`fontEmbedCSS prepare: ${(tFontEmbedReady - tMeasured).toFixed(1)} ms`);
      console.log(`html-to-image/toCanvas (内部でのimage embedding込み。fontEmbedCSS指定によりfont再取得はskip): ${(tCaptured - tFontEmbedReady).toFixed(1)} ms`);
      console.log(`post-process (transform復元): ${(tEnd - tCaptured).toFixed(1)} ms`);
      console.log(`total capture: ${(tEnd - tStart).toFixed(1)} ms`);
    }
  }
}
