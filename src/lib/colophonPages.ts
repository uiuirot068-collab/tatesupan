import type { ColophonPlacement, ColophonRenderRow, ColophonTemplateId } from "./colophon";
import { colophonTemplateLayoutPlan } from "./colophonLayoutPlan";
import {
  buildColophonRenderPlan,
  type ColophonRenderItem,
  type ColophonRenderPlan,
  type ColophonRenderText,
} from "./colophonRenderPlan";

/**
 * TSP-PRINT-001: a colophon that does not fit one page continues on the next
 * pages. Preview, PDF and JPG all take their pages from here, so they show the
 * same lines on the same pages:
 *
 * - The page count comes from the horizontal colophon itself (its lines and
 *   the placement area's height), not from Core's vertical body layout.
 * - Lines are never split; a page ends before the line that would cross the
 *   bottom of the placement area.
 * - A continuation page starts with its own first line at the top (the gap
 *   and the classic rule above free text only separate it from rows on the
 *   same page). Classic draws its frame around each page's part.
 * - A colophon that fits one page is returned unchanged.
 */

const EPSILON_EM = 1e-6;

export interface ColophonAreaGeometry {
  paperWidthMm: number;
  paperHeightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginGutterMm: number;
  marginOuterMm: number;
}

/** The placement area by margins only (before running head / folio bands). */
export function colophonPlacementAreaMm(
  geometry: ColophonAreaGeometry,
  placement: Pick<ColophonPlacement, "respectGutter" | "respectVerticalMargins"> | undefined,
  isOddPage: boolean
): { leftMm: number; rightMm: number; topMm: number; bottomMm: number } {
  const respectGutter = placement?.respectGutter ?? false;
  const respectVerticalMargins = placement?.respectVerticalMargins ?? true;
  const symmetricHorizontalMm = Math.min(geometry.marginGutterMm, geometry.marginOuterMm);
  const symmetricVerticalMm = Math.min(geometry.marginTopMm, geometry.marginBottomMm);
  const leftMarginMm = respectGutter ? (isOddPage ? geometry.marginOuterMm : geometry.marginGutterMm) : symmetricHorizontalMm;
  const rightMarginMm = respectGutter ? (isOddPage ? geometry.marginGutterMm : geometry.marginOuterMm) : symmetricHorizontalMm;
  const topMarginMm = respectVerticalMargins ? geometry.marginTopMm : symmetricVerticalMm;
  const bottomMarginMm = respectVerticalMargins ? geometry.marginBottomMm : symmetricVerticalMm;
  return {
    leftMm: leftMarginMm,
    rightMm: geometry.paperWidthMm - rightMarginMm,
    topMm: topMarginMm,
    bottomMm: geometry.paperHeightMm - bottomMarginMm,
  };
}

/** The colophon's em in mm: its own size (clamped 4–24pt), else the body's. */
export function colophonEmMm(colophonFontSizePt: number | null | undefined, bodyEmMm: number): number {
  return typeof colophonFontSizePt === "number" && Number.isFinite(colophonFontSizePt)
    ? Math.min(24, Math.max(4, colophonFontSizePt)) * (25.4 / 72)
    : bodyEmMm;
}

interface Band {
  top: number;
  bottom: number;
}

function textBand(item: ColophonRenderText, lineHeight: number): Band {
  const half = (item.fontScale * lineHeight) / 2;
  return { top: item.yEm - half, bottom: item.yEm + half };
}

function shift(item: ColophonRenderItem, offsetEm: number): ColophonRenderItem {
  return { ...item, yEm: item.yEm - offsetEm };
}

/** Splits a render plan into pages no taller than `pageHeightEm`. */
export function paginateColophonRenderPlan(
  plan: ColophonRenderPlan,
  pageHeightEm: number,
  templateId: ColophonTemplateId
): ColophonRenderPlan[] {
  if (!(pageHeightEm > 0) || plan.heightEm <= pageHeightEm + EPSILON_EM) return [plan];

  const layout = colophonTemplateLayoutPlan(templateId);
  const classic = templateId === "classic";
  // Classic keeps its frame padding (and the row padding) on every page.
  const edgeEm = classic ? layout.paddingYEm + layout.rowPaddingEm : 0;

  // Items painted on the same line (a label and its value) move together.
  const lines: { band: Band; items: ColophonRenderText[] }[] = [];
  for (const item of plan.items) {
    if (item.kind !== "text") continue;
    const band = textBand(item, layout.lineHeight);
    const same = lines.find((line) => Math.abs(line.items[0].yEm - item.yEm) < EPSILON_EM);
    if (same) {
      same.items.push(item);
      same.band = { top: Math.min(same.band.top, band.top), bottom: Math.max(same.band.bottom, band.bottom) };
    } else {
      lines.push({ band, items: [item] });
    }
  }
  lines.sort((a, b) => a.band.top - b.band.top);
  if (lines.length === 0) return [plan];

  // TSP-PRINT-003: one row's lines (its label and every value line) form a
  // block that moves to the next page as a whole, so a label never ends a
  // page while its value starts the next one. Free text and the minimal
  // template's title are one block per line. A row taller than a whole page
  // still starts on a fresh page and then continues line by line.
  const blocks: { first: number; last: number }[] = [];
  lines.forEach((line, index) => {
    const row = line.items[0].row;
    const previous = blocks[blocks.length - 1];
    if (row !== undefined && previous && lines[previous.last].items[0].row === row) previous.last = index;
    else blocks.push({ first: index, last: index });
  });

  const pageOfLine: number[] = [];
  const offsets: number[] = [];
  const bottoms: number[] = [];
  const fitsOnPage = (page: number, bottom: number) => page >= 0 && bottom - offsets[page] + edgeEm <= pageHeightEm + EPSILON_EM;
  const openPage = (top: number) => {
    // The first page keeps the plan's own top; later pages start at the line.
    offsets.push(offsets.length === 0 ? 0 : top - edgeEm);
    bottoms.push(top);
  };
  for (const block of blocks) {
    const top = lines[block.first].band.top;
    const bottom = lines[block.last].band.bottom;
    if (!fitsOnPage(offsets.length - 1, bottom)) openPage(top);
    for (let index = block.first; index <= block.last; index++) {
      const line = lines[index];
      if (!fitsOnPage(offsets.length - 1, line.band.bottom)) openPage(line.band.top);
      const page = offsets.length - 1;
      pageOfLine[index] = page;
      bottoms[page] = line.band.bottom;
    }
  }
  if (offsets.length === 1) return [plan];

  const pages: ColophonRenderPlan[] = offsets.map((offset, page) => ({
    widthEm: plan.widthEm,
    heightEm: Math.max(bottoms[page] - offset + edgeEm, 1),
    items: [],
  }));
  for (const frame of plan.items) {
    if (frame.kind !== "frame") continue;
    pages.forEach((page) => page.items.push({ ...frame, yEm: 0, heightEm: page.heightEm }));
  }
  lines.forEach((line, index) => {
    const page = pageOfLine[index];
    for (const item of line.items) pages[page].items.push(shift(item, offsets[page]));
  });
  // A rule separates two lines; it stays only when both are on the same page.
  for (const rule of plan.items) {
    if (rule.kind !== "rule") continue;
    let before = -1;
    let after = -1;
    lines.forEach((line, index) => {
      if (line.band.top < rule.yEm - EPSILON_EM) before = index;
      else if (after < 0) after = index;
    });
    if (before < 0 || after < 0 || pageOfLine[before] !== pageOfLine[after]) continue;
    const page = pageOfLine[before];
    pages[page].items.push(shift(rule, offsets[page]));
  }
  return pages;
}

export interface BuildColophonPagePlansInput {
  templateId: ColophonTemplateId;
  rows: ColophonRenderRow[];
  freeText: string;
  titleFallback: string;
  geometry: ColophonAreaGeometry;
  placement: Pick<ColophonPlacement, "respectGutter" | "respectVerticalMargins"> | undefined;
  emMm: number;
}

/**
 * The colophon's pages for this paper. Width and height come from the
 * placement area of an odd page (both parities have the same width).
 */
export function buildColophonPagePlans(input: BuildColophonPagePlansInput): ColophonRenderPlan[] {
  const area = colophonPlacementAreaMm(input.geometry, input.placement, true);
  const emMm = Math.max(input.emMm, 0.001);
  const plan = buildColophonRenderPlan({
    templateId: input.templateId,
    rows: input.rows,
    freeText: input.freeText,
    titleFallback: input.titleFallback,
    availableWidthEm: Math.max(area.rightMm - area.leftMm, 0) / emMm,
  });
  return paginateColophonRenderPlan(plan, Math.max(area.bottomMm - area.topMm, 0) / emMm, input.templateId);
}
