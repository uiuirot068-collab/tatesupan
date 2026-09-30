"use client";

import type { ColophonRenderRow, ColophonTemplateId } from "@/lib/colophon";
import { buildColophonRenderPlan } from "@/lib/colophonRenderPlan";

interface ColophonTemplateContentProps {
  templateId: ColophonTemplateId;
  rows: ColophonRenderRow[];
  freeText: string;
  basePx: number;
  titleFallback: string;
  availableWidthEm: number;
}

export function ColophonTemplateContent({
  templateId,
  rows,
  freeText,
  basePx,
  titleFallback,
  availableWidthEm,
}: ColophonTemplateContentProps) {
  const plan = buildColophonRenderPlan({
    templateId,
    rows,
    freeText,
    titleFallback,
    availableWidthEm,
  });

  return (
    <div
      data-colophon-render-plan={templateId}
      style={{
        position: "relative",
        width: `${plan.widthEm * basePx}px`,
        height: `${plan.heightEm * basePx}px`,
        flex: "0 0 auto",
      }}
    >
      {plan.items.map((item, index) => {
        if (item.kind === "frame") {
          return (
            <div
              key={`frame-${index}`}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: item.xEm * basePx,
                top: item.yEm * basePx,
                width: item.widthEm * basePx,
                height: item.heightEm * basePx,
                border: `1px solid rgba(0,0,0,${item.alpha})`,
                boxSizing: "border-box",
              }}
            />
          );
        }

        if (item.kind === "rule") {
          return (
            <div
              key={`rule-${index}`}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: item.xEm * basePx,
                top: item.yEm * basePx,
                width: item.widthEm * basePx,
                borderTop: `1px solid rgba(0,0,0,${item.alpha})`,
              }}
            />
          );
        }

        return (
          <span
            key={`text-${index}`}
            style={{
              position: "absolute",
              left: item.xEm * basePx,
              top: item.yEm * basePx,
              transform:
                item.align === "center"
                  ? "translate(-50%, -50%)"
                  : item.align === "right"
                    ? "translate(-100%, -50%)"
                    : "translateY(-50%)",
              transformOrigin: "center",
              whiteSpace: "pre",
              fontSize: `${basePx * item.fontScale}px`,
              lineHeight: 1,
              textAlign: item.align,
              opacity: item.opacity ?? 1,
              fontWeight: item.weight ?? 400,
            }}
          >
            {item.text}
          </span>
        );
      })}
    </div>
  );
}
