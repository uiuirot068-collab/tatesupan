import { withBasePath } from "@/lib/basePath";
import { SNS_CREDIT_URL } from "@/lib/snsCredit";
import { WEB_FOOTER_BRAND_SOURCE_HEIGHT, WEB_FOOTER_BRAND_SOURCE_WIDTH } from "@/lib/webFooterBranding";

/**
 * SPN-XFIX-002: JPG書き出し（V2）では紙面のDOMを使わないので、「SNS用 4:5」の
 * クレジットを書き出し用のキャンバスに直接描く。PageCard の SnsFooterOverlay と
 * 同じ寸法（用紙 1080px 幅を基準に、書き出しの倍率で拡大）。
 */
const PAPER_WIDTH_PX = 1080;
const SIDE_PX = 60;
const BOTTOM_PX = 14;
const PAD_TOP_PX = 10;
const LOGO_W_PX = 30;
const GAP_PX = 14;
const MAIN_FONT_PX = 21;
const FINE_FONT_PX = 18;

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
  const rowH = Math.max(logoH, MAIN_FONT_PX * 1.2);
  const lineY = heightPx - s * (BOTTOM_PX + PAD_TOP_PX + rowH);
  const midY = lineY + s * (PAD_TOP_PX + rowH / 2);

  ctx.save();
  // 本文の描画で残った拡大・移動をいったん外し、書き出し画像のピクセルで描く
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = "#d6d2ca";
  ctx.lineWidth = Math.max(1, s);
  ctx.beginPath();
  ctx.moveTo(s * SIDE_PX, lineY);
  ctx.lineTo(widthPx - s * SIDE_PX, lineY);
  ctx.stroke();

  const parts: Array<{ text: string; size: number }> = [
    { text: "TateSpun", size: MAIN_FONT_PX },
    { text: SNS_CREDIT_URL, size: FINE_FONT_PX },
  ];
  if (snsId) parts.push({ text: snsId, size: FINE_FONT_PX });
  const fontOf = (size: number) => `${size * s}px "Shippori Mincho", serif`;
  const widths = parts.map((p) => {
    ctx.font = fontOf(p.size);
    return ctx.measureText(p.text).width;
  });
  const logoW = logo ? LOGO_W_PX * s : 0;
  const total = logoW + widths.reduce((a, b) => a + b, 0) + GAP_PX * s * (parts.length - (logo ? 0 : 1));
  let x = (widthPx - total) / 2;
  if (logo) {
    ctx.drawImage(logo, x, midY - (logoH * s) / 2, logoW, logoH * s);
    x += logoW + GAP_PX * s;
  }
  ctx.fillStyle = "#7a766f";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  parts.forEach((p, i) => {
    ctx.font = fontOf(p.size);
    ctx.fillText(p.text, x, midY);
    x += widths[i] + GAP_PX * s;
  });
  ctx.restore();
}
