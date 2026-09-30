"use client";

import type { ColophonRenderRow, ColophonTemplateId } from "@/lib/colophon";
import { colophonTemplateLayoutPlan } from "@/lib/colophonLayoutPlan";

interface ColophonTemplateContentProps {
  templateId: ColophonTemplateId;
  rows: ColophonRenderRow[];
  freeText: string;
  basePx: number;
  titleFallback: string;
}

export function ColophonTemplateContent({
  templateId,
  rows,
  freeText,
  basePx,
  titleFallback,
}: ColophonTemplateContentProps) {
  const plan = colophonTemplateLayoutPlan(templateId);

  const freeTextNode = freeText.trim() === "" ? null : (
    <p
      style={{
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        margin: 0,
        fontSize: `${basePx * plan.freeTextScale}px`,
        lineHeight: plan.lineHeight,
        textAlign: plan.align,
        opacity: 0.85,
      }}
    >
      {freeText}
    </p>
  );

  if (templateId === "center") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: `${basePx * plan.centerRowGapEm}px`,
        }}
      >
        {rows.map((row) => (
          <div
            key={row.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: `${basePx * plan.centerLabelValueGapEm}px`,
            }}
          >
            {row.label.trim() !== "" && (
              <span style={{ fontSize: `${basePx * plan.centerLabelScale}px`, opacity: 0.6 }}>
                {row.label}
              </span>
            )}
            <span>{row.value}</span>
          </div>
        ))}
        {freeTextNode && <div style={{ height: `${basePx * plan.freeTextGapEm}px` }} />}
        {freeTextNode}
      </div>
    );
  }

  if (templateId === "minimal") {
    const titleRow = rows.find((row) => row.id === "title") ?? rows[0];
    const rest = rows.filter((row) => row !== titleRow);
    const mainTitle = (titleRow?.value ?? "").trim() || titleFallback;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: `${basePx * plan.titleGapEm}px` }}>
        {mainTitle !== "" && (
          <div style={{ fontSize: `${basePx * plan.titleScale}px`, fontWeight: 600, letterSpacing: "0.02em" }}>
            {mainTitle}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: `${basePx * plan.restGapEm}px` }}>
          {rest.map((row) => (
            <div key={row.id} style={{ fontSize: `${basePx * plan.restScale}px`, opacity: 0.8 }}>
              {row.label.trim() !== "" ? `${row.label}：${row.value}` : row.value}
            </div>
          ))}
        </div>
        {freeTextNode}
      </div>
    );
  }

  if (templateId === "classic") {
    return (
      <div
        style={{
          border: plan.border ? `1px solid rgba(0,0,0,${plan.borderAlpha})` : undefined,
          padding: `${basePx * plan.paddingYEm}px ${basePx * plan.paddingXEm}px`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((row, index) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: `${basePx * plan.labelWidthEm}px minmax(0,1fr)`,
                columnGap: `${basePx * plan.labelValueGapEm}px`,
                padding: `${basePx * plan.rowPaddingEm}px 0`,
                borderBottom:
                  plan.rowRule && index !== rows.length - 1
                    ? `1px solid rgba(0,0,0,${plan.rowRuleAlpha})`
                    : "none",
                fontWeight: row.id === "title" ? 600 : 400,
              }}
            >
              <span style={{ opacity: 0.7 }}>{row.label}</span>
              <span>{row.value}</span>
            </div>
          ))}
        </div>
        {freeTextNode && (
          <>
            <div
              style={{
                borderTop: "1px solid rgba(0,0,0,0.3)",
                margin: `${basePx * plan.freeTextGapEm}px 0`,
              }}
            />
            {freeTextNode}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: `${basePx * plan.freeTextGapEm}px` }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${basePx * plan.labelWidthEm}px minmax(0,1fr)`,
          columnGap: `${basePx * plan.labelValueGapEm}px`,
          rowGap: `${basePx * plan.rowGapEm}px`,
        }}
      >
        {rows.map((row) => (
          <div key={row.id} style={{ display: "contents" }}>
            <span style={{ opacity: 0.7 }}>{row.label}</span>
            <span>{row.value}</span>
          </div>
        ))}
      </div>
      {freeTextNode}
    </div>
  );
}
