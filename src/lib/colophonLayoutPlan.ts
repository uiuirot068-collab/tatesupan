import type { ColophonTemplateId } from "./colophon";

export interface ColophonTemplateLayoutPlan {
  frameWidthRatio: number;
  freeTextScale: number;
  lineHeight: number;
  border: boolean;
  borderAlpha: number;
  paddingXEm: number;
  paddingYEm: number;
  rowRule: boolean;
  rowRuleAlpha: number;
  rowPaddingEm: number;
  labelWidthEm: number;
  labelValueGapEm: number;
  rowGapEm: number;
  titleScale: number;
  restScale: number;
  titleGapEm: number;
  restGapEm: number;
  centerLabelScale: number;
  centerLabelValueGapEm: number;
  centerRowGapEm: number;
  freeTextGapEm: number;
  align: "left" | "center";
}

/**
 * Single source of truth for colophon template geometry.
 * Preview and Publication both consume this plan. Values are ratios / ems,
 * never renderer-specific px/mm coordinates.
 */
const PLANS: Record<ColophonTemplateId, ColophonTemplateLayoutPlan> = {
  standard: {
    frameWidthRatio: 0.68,
    freeTextScale: 0.86,
    lineHeight: 1.8,
    border: false,
    borderAlpha: 0,
    paddingXEm: 0,
    paddingYEm: 0,
    rowRule: false,
    rowRuleAlpha: 0,
    rowPaddingEm: 0,
    labelWidthEm: 6,
    labelValueGapEm: 1.6,
    rowGapEm: 0.7,
    titleScale: 1,
    restScale: 1,
    titleGapEm: 0,
    restGapEm: 0,
    centerLabelScale: 0.78,
    centerLabelValueGapEm: 0.15,
    centerRowGapEm: 1.1,
    freeTextGapEm: 1.4,
    align: "left",
  },
  center: {
    frameWidthRatio: 0.68,
    freeTextScale: 0.86,
    lineHeight: 1.8,
    border: false,
    borderAlpha: 0,
    paddingXEm: 0,
    paddingYEm: 0,
    rowRule: false,
    rowRuleAlpha: 0,
    rowPaddingEm: 0,
    labelWidthEm: 0,
    labelValueGapEm: 0,
    rowGapEm: 0,
    titleScale: 1,
    restScale: 1,
    titleGapEm: 0,
    restGapEm: 0,
    centerLabelScale: 0.78,
    centerLabelValueGapEm: 0.15,
    centerRowGapEm: 1.1,
    freeTextGapEm: 0.6,
    align: "center",
  },
  minimal: {
    frameWidthRatio: 0.68,
    freeTextScale: 0.86,
    lineHeight: 1.8,
    border: false,
    borderAlpha: 0,
    paddingXEm: 0,
    paddingYEm: 0,
    rowRule: false,
    rowRuleAlpha: 0,
    rowPaddingEm: 0,
    labelWidthEm: 0,
    labelValueGapEm: 0,
    rowGapEm: 0,
    titleScale: 1.7,
    restScale: 0.9,
    titleGapEm: 2.4,
    restGapEm: 0.4,
    centerLabelScale: 0.78,
    centerLabelValueGapEm: 0.15,
    centerRowGapEm: 1.1,
    freeTextGapEm: 2.4,
    align: "left",
  },
  classic: {
    frameWidthRatio: 0.76,
    freeTextScale: 0.86,
    lineHeight: 1.8,
    border: true,
    borderAlpha: 0.55,
    paddingXEm: 1.3,
    paddingYEm: 1.1,
    rowRule: true,
    rowRuleAlpha: 0.15,
    rowPaddingEm: 0.5,
    labelWidthEm: 6,
    labelValueGapEm: 1,
    rowGapEm: 0,
    titleScale: 1,
    restScale: 1,
    titleGapEm: 0,
    restGapEm: 0,
    centerLabelScale: 0.78,
    centerLabelValueGapEm: 0.15,
    centerRowGapEm: 1.1,
    freeTextGapEm: 0.9,
    align: "left",
  },
};

export function colophonTemplateLayoutPlan(templateId: ColophonTemplateId): ColophonTemplateLayoutPlan {
  return PLANS[templateId] ?? PLANS.standard;
}
