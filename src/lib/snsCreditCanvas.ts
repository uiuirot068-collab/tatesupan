import { withBasePath } from "@/lib/basePath";
import { SNS_CREDIT_URL } from "@/lib/snsCredit";
import { WEB_FOOTER_BRAND_CSS_WIDTH, WEB_FOOTER_BRAND_SOURCE_HEIGHT, WEB_FOOTER_BRAND_SOURCE_WIDTH } from "@/lib/webFooterBranding";
import {
  WEB_FOOTER_BOTTOM_PX,
  WEB_FOOTER_FONT_FAMILY,
  WEB_FOOTER_GAP_PX,
  WEB_FOOTER_HASHTAG,
  WEB_FOOTER_PAD_BOTTOM_PX,
  WEB_FOOTER_PAD_LEFT_PX,
  WEB_FOOTER_PAD_RIGHT_PX,
  WEB_FOOTER_PAD_TOP_PX,
  WEB_FOOTER_RULE_COLOR,
  WEB_FOOTER_RULE_PX,
  WEB_FOOTER_TEXT_COLOR,
  WEB_FOOTER_URL,
  webFooterFontSizesPx,
} from "@/lib/webFooterLayout";

/**
 * SPN-XFIX-002: JPG書き出し（V2）では紙面のDOMを使わないので、「SNS用 4:5」の
 * クレジットを書き出し用のキャンバスに直接描く。PageCard の SnsFooterOverlay と
 * 同じ寸法（用紙 1080px 幅を基準に、書き出しの倍率で拡大）。
 */
const PAPER_WIDTH_PX = 1080;
/** Web閲覧用 page width in paper px. */
const WEB_PAGE_WIDTH_PX = 768;
const SIDE_PX = 60;
const BOTTOM_PX = 14;
const PAD_TOP_PX = 10;
const LOGO_W_PX = 30;
const GAP_PX = 14;
const MAIN_FONT_PX = 21;
const FINE_FONT_PX = 18;
const LINE_HEIGHT = 1.2;
const RULE_PX = 1;

let logoPromise: Promise<HTMLImageElement | null> | null = null;
function loadLogo(): Promise<HTMLImageElement | null> {
  if (!logoPromise) {
    logoPromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = withBasePath("/caroad_main2.png");
    });
  }
  return logoPromise;
}

export async function drawSnsCredit(ctx: CanvasRenderingContext2D, widthPx: number, heightPx: number, snsId: string): Promise<void> {
  const s = widthPx / PAPER_WIDTH_PX;
  const logo = await loadLogo();
  const logoH = (LOGO_W_PX * WEB_FOOTER_BRAND_SOURCE_HEIGHT) / WEB_FOOTER_BRAND_SOURCE_WIDTH;
  const rowH = Math.max(logoH, MAIN_FONT_PX * LINE_HEIGHT);
  // The overlay's 1px border-top sits above its 10px padding (TSP-PRINT-004).
  const lineY = heightPx - s * (BOTTOM_PX + PAD_TOP_PX + rowH + RULE_PX);
  const midY = heightPx - s * (BOTTOM_PX + rowH / 2);

  ctx.save();
  // 本文の描画で残った拡大・移動をいったん外し、書き出し画像のピクセルで描く
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#d6d2ca";
  ctx.fillRect(s * SIDE_PX, lineY, widthPx - s * SIDE_PX * 2, Math.max(1, s * RULE_PX));

  const parts: Array<{ text: string; size: number }> = [
    { text: "TateSpun", size: MAIN_FONT_PX },
    { text: SNS_CREDIT_URL, size: FINE_FONT_PX },
  ];
  if (snsId) parts.push({ text: snsId, size: FINE_FONT_PX });
  const fontOf = (size: number) => `${size * s}px "Shippori Mincho", serif`;
  // TSP-PRINT-004: each text is placed as CSS places a line-height:1.2 box
  // centred in the row (baseline = half-leading + ascent below the box top),
  // not on Canvas's own "middle", which sat 2px off the Preview.
  const metrics = parts.map((p) => {
    ctx.font = fontOf(p.size);
    const m = ctx.measureText(p.text);
    const ascent = m.fontBoundingBoxAscent ?? p.size * s * 0.88;
    const descent = m.fontBoundingBoxDescent ?? p.size * s * 0.12;
    const boxH = p.size * s * LINE_HEIGHT;
    return { width: m.width, baselineFromMid: -boxH / 2 + (boxH - ascent - descent) / 2 + ascent };
  });
  const logoW = logo ? LOGO_W_PX * s : 0;
  const total = logoW + metrics.reduce((a, m) => a + m.width, 0) + GAP_PX * s * (parts.length - (logo ? 0 : 1));
  let x = (widthPx - total) / 2;
  if (logo) {
    ctx.drawImage(logo, x, midY - (logoH * s) / 2, logoW, logoH * s);
    x += logoW + GAP_PX * s;
  }
  ctx.fillStyle = "#7a766f";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  parts.forEach((p, i) => {
    ctx.font = fontOf(p.size);
    ctx.fillText(p.text, x, midY + metrics[i].baselineFromMid);
    x += metrics[i].width + GAP_PX * s;
  });
  ctx.restore();
}

/**
 * TSP-PRINT-004 (P4-8): the Web閲覧用 footer on a JPG page canvas — the same
 * rule, logo and text the Preview's WebFooterOverlay lays out with CSS
 * (lib/webFooterLayout.ts), computed the way CSS places them: a 1px rule
 * across the page, then one centred row (flex, `align-items: center`) whose
 * height is the tallest item; each text box is its font's normal line
 * height (ascent + descent), so its baseline sits `ascent` below the box top.
 * `bodyFontSizePx` is the Web body size in page px (768px-wide page).
 */
export async function drawWebFooter(ctx: CanvasRenderingContext2D, widthPx: number, heightPx: number, bodyFontSizePx: number): Promise<void> {
  const s = widthPx / WEB_PAGE_WIDTH_PX;
  const logo = await loadLogo();
  const sizes = webFooterFontSizesPx(bodyFontSizePx);
  const parts = [
    { text: "TateSpun", size: sizes.main },
    { text: WEB_FOOTER_URL, size: sizes.fine },
    { text: WEB_FOOTER_HASHTAG, size: sizes.fine },
  ];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const fontOf = (size: number) => `${size * s}px ${WEB_FOOTER_FONT_FAMILY}`;
  const metrics = parts.map((p) => {
    ctx.font = fontOf(p.size);
    const m = ctx.measureText(p.text);
    const ascent = m.fontBoundingBoxAscent ?? p.size * s * 0.88;
    const descent = m.fontBoundingBoxDescent ?? p.size * s * 0.12;
    return { width: m.width, ascent, height: ascent + descent };
  });
  const logoW = logo ? WEB_FOOTER_BRAND_CSS_WIDTH * s : 0;
  const logoH = logo ? (logoW * WEB_FOOTER_BRAND_SOURCE_HEIGHT) / WEB_FOOTER_BRAND_SOURCE_WIDTH : 0;
  const rowH = Math.max(logoH, ...metrics.map((m) => m.height));
  const bottom = heightPx - s * (WEB_FOOTER_BOTTOM_PX + WEB_FOOTER_PAD_BOTTOM_PX);
  const midY = bottom - rowH / 2;
  const ruleTop = bottom - rowH - s * (WEB_FOOTER_PAD_TOP_PX + WEB_FOOTER_RULE_PX);

  ctx.fillStyle = WEB_FOOTER_RULE_COLOR;
  ctx.fillRect(0, ruleTop, widthPx, Math.max(1, s * WEB_FOOTER_RULE_PX));

  const items = (logo ? 1 : 0) + parts.length;
  const total = logoW + metrics.reduce((sum, m) => sum + m.width, 0) + s * WEB_FOOTER_GAP_PX * (items - 1);
  const innerLeft = s * WEB_FOOTER_PAD_LEFT_PX;
  const innerWidth = widthPx - s * (WEB_FOOTER_PAD_LEFT_PX + WEB_FOOTER_PAD_RIGHT_PX);
  let x = innerLeft + (innerWidth - total) / 2;
  if (logo) {
    ctx.drawImage(logo, x, midY - logoH / 2, logoW, logoH);
    x += logoW + s * WEB_FOOTER_GAP_PX;
  }
  ctx.fillStyle = WEB_FOOTER_TEXT_COLOR;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  parts.forEach((p, i) => {
    const m = metrics[i];
    ctx.font = fontOf(p.size);
    ctx.fillText(p.text, x, midY - m.height / 2 + m.ascent);
    x += m.width + s * WEB_FOOTER_GAP_PX;
  });
  ctx.restore();
}
