import type { ColophonRenderRow, ColophonTemplateId } from "./colophon";
import { colophonTemplateLayoutPlan } from "./colophonLayoutPlan";

export interface ColophonRenderText {
  kind: "text";
  text: string;
  xEm: number;
  yEm: number;
  fontScale: number;
  align: "left" | "center" | "right";
  opacity?: number;
  weight?: 400 | 600 | 700;
}

export interface ColophonRenderRule {
  kind: "rule";
  xEm: number;
  yEm: number;
  widthEm: number;
  alpha: number;
}

export interface ColophonRenderFrame {
  kind: "frame";
  xEm: number;
  yEm: number;
  widthEm: number;
  heightEm: number;
  alpha: number;
}

export type ColophonRenderItem = ColophonRenderText | ColophonRenderRule | ColophonRenderFrame;

export interface ColophonRenderPlan {
  widthEm: number;
  heightEm: number;
  items: ColophonRenderItem[];
}

export interface BuildColophonRenderPlanInput {
  templateId: ColophonTemplateId;
  rows: ColophonRenderRow[];
  freeText: string;
  titleFallback: string;
  availableWidthEm: number;
}

function charWidthEm(ch: string): number {
  if (/^[\x00-\x7f]$/.test(ch)) return 0.56;
  return 1;
}

function wrapLine(text: string, widthEm: number, fontScale: number): string[] {
  if (text.length === 0) return [""];
  const max = Math.max(widthEm, 0.5);
  const out: string[] = [];
  let current = "";
  let used = 0;
  for (const ch of Array.from(text)) {
    const w = charWidthEm(ch) * fontScale;
    if (current && used + w > max) {
      out.push(current);
      current = ch;
      used = w;
    } else {
      current += ch;
      used += w;
    }
  }
  if (current || out.length === 0) out.push(current);
  return out;
}

function wrapText(text: string, widthEm: number, fontScale: number): string[] {
  if (text.trim() === "") return [];
  return text.replace(/\r\n/g, "\n").split("\n").flatMap((line) => wrapLine(line, widthEm, fontScale));
}

export function buildColophonRenderPlan(input: BuildColophonRenderPlanInput): ColophonRenderPlan {
  const p = colophonTemplateLayoutPlan(input.templateId);
  const widthEm = Math.max(8, input.availableWidthEm * p.frameWidthRatio);
  const items: ColophonRenderItem[] = [];

  if (input.templateId === "center") {
    let y = 0;
    for (const row of input.rows) {
      if (row.label.trim() !== "") {
        const labelLineH = p.centerLabelScale * p.lineHeight;
        items.push({
          kind: "text",
          text: row.label,
          xEm: widthEm / 2,
          yEm: y + labelLineH / 2,
          fontScale: p.centerLabelScale,
          align: "center",
          opacity: 0.6,
        });
        y += labelLineH + p.centerLabelValueGapEm;
      }
      const valueLines = wrapLine(row.value, widthEm, 1);
      for (const line of valueLines) {
        items.push({
          kind: "text",
          text: line,
          xEm: widthEm / 2,
          yEm: y + p.lineHeight / 2,
          fontScale: 1,
          align: "center",
        });
        y += p.lineHeight;
      }
      y += p.centerRowGapEm;
    }
    const freeLines = wrapText(input.freeText, widthEm, p.freeTextScale);
    if (freeLines.length > 0) {
      y += p.freeTextGapEm;
      const lineH = p.freeTextScale * p.lineHeight;
      for (const line of freeLines) {
        items.push({
          kind: "text",
          text: line,
          xEm: widthEm / 2,
          yEm: y + lineH / 2,
          fontScale: p.freeTextScale,
          align: "center",
          opacity: 0.85,
        });
        y += lineH;
      }
    }
    return { widthEm, heightEm: Math.max(y, 1), items };
  }

  if (input.templateId === "minimal") {
    const titleRow = input.rows.find((row) => row.id === "title") ?? input.rows[0];
    const rest = input.rows.filter((row) => row !== titleRow);
    const mainTitle = (titleRow?.value ?? "").trim() || input.titleFallback;
    let y = 0;

    if (mainTitle !== "") {
      const titleH = p.titleScale * p.lineHeight;
      items.push({
        kind: "text",
        text: mainTitle,
        xEm: 0,
        yEm: y + titleH / 2,
        fontScale: p.titleScale,
        align: "left",
        weight: 600,
      });
      y += titleH;
    }

    if (rest.length > 0) {
      if (mainTitle !== "") y += p.titleGapEm;
      const restH = p.restScale * p.lineHeight;
      rest.forEach((row, index) => {
        const text = row.label.trim() !== "" ? `${row.label}：${row.value}` : row.value;
        const lines = wrapLine(text, widthEm, p.restScale);
        for (const line of lines) {
          items.push({
            kind: "text",
            text: line,
            xEm: 0,
            yEm: y + restH / 2,
            fontScale: p.restScale,
            align: "left",
            opacity: 0.8,
          });
          y += restH;
        }
        if (index < rest.length - 1) y += p.restGapEm;
      });
    }

    const freeLines = wrapText(input.freeText, widthEm, p.freeTextScale);
    if (freeLines.length > 0) {
      if (y > 0) y += p.freeTextGapEm;
      const freeH = p.freeTextScale * p.lineHeight;
      for (const line of freeLines) {
        items.push({
          kind: "text",
          text: line,
          xEm: 0,
          yEm: y + freeH / 2,
          fontScale: p.freeTextScale,
          align: "left",
          opacity: 0.85,
        });
        y += freeH;
      }
    }

    return { widthEm, heightEm: Math.max(y, 1), items };
  }

  const padX = input.templateId === "classic" ? p.paddingXEm : 0;
  const padY = input.templateId === "classic" ? p.paddingYEm : 0;
  const innerWidthEm = Math.max(widthEm - padX * 2, 1);
  const labelWidthEm = Math.min(p.labelWidthEm, innerWidthEm * 0.45);
  const valueX = padX + labelWidthEm + p.labelValueGapEm;
  const valueWidthEm = Math.max(innerWidthEm - labelWidthEm - p.labelValueGapEm, 1);
  let y = padY;

  if (input.templateId === "classic") {
    items.push({ kind: "frame", xEm: 0, yEm: 0, widthEm, heightEm: 0, alpha: p.borderAlpha });
  }

  input.rows.forEach((row, index) => {
    const lines = wrapLine(row.value, valueWidthEm, 1);
    const lineCount = Math.max(1, lines.length);
    const rowTextHeight = lineCount * p.lineHeight;
    const rowTop = y;
    const textTop = rowTop + (input.templateId === "classic" ? p.rowPaddingEm : 0);

    items.push({
      kind: "text",
      text: row.label,
      xEm: padX,
      yEm: textTop + p.lineHeight / 2,
      fontScale: 1,
      align: "left",
      opacity: 0.7,
      weight: row.id === "title" && input.templateId === "classic" ? 600 : 400,
    });

    lines.forEach((line, lineIndex) => {
      items.push({
        kind: "text",
        text: line,
        xEm: valueX,
        yEm: textTop + lineIndex * p.lineHeight + p.lineHeight / 2,
        fontScale: 1,
        align: "left",
      });
    });

    y += rowTextHeight;
    if (input.templateId === "classic") {
      y += p.rowPaddingEm * 2;
      if (p.rowRule && index < input.rows.length - 1) {
        items.push({
          kind: "rule",
          xEm: padX,
          yEm: y,
          widthEm: innerWidthEm,
          alpha: p.rowRuleAlpha,
        });
      }
    } else if (index < input.rows.length - 1) {
      y += p.rowGapEm;
    }
  });

  const freeLines = wrapText(input.freeText, innerWidthEm, p.freeTextScale);
  if (freeLines.length > 0) {
    if (input.templateId === "classic") {
      y += p.freeTextGapEm;
      items.push({ kind: "rule", xEm: padX, yEm: y, widthEm: innerWidthEm, alpha: 0.3 });
      y += p.freeTextGapEm;
    } else {
      y += p.freeTextGapEm;
    }

    const freeH = p.freeTextScale * p.lineHeight;
    for (const line of freeLines) {
      items.push({
        kind: "text",
        text: line,
        xEm: padX,
        yEm: y + freeH / 2,
        fontScale: p.freeTextScale,
        align: "left",
        opacity: 0.85,
      });
      y += freeH;
    }
  }

  y += padY;
  if (input.templateId === "classic") {
    const frame = items.find((item): item is ColophonRenderFrame => item.kind === "frame");
    if (frame) frame.heightEm = Math.max(y, 1);
  }

  return { widthEm, heightEm: Math.max(y, 1), items };
}
