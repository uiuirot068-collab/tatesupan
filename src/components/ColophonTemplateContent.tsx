"use client";

import type { ColophonRenderRow, ColophonTemplateId } from "@/lib/colophon";

interface ColophonTemplateContentProps {
  templateId: ColophonTemplateId;
  rows: ColophonRenderRow[];
  freeText: string;
  basePx: number;
  titleFallback: string;
}

/**
 * Shared visual layer for TateSpun colophon pages.
 *
 * Phase 11 moves the colophon appearance out of the LEGACY page renderer so
 * both the fallback renderer and the canonical V2 preview consume one visual
 * definition. It does not own pagination, page order, folio numbering, or
 * editor state.
 */
export function ColophonTemplateContent({
  templateId,
  rows,
  freeText,
  basePx,
  titleFallback,
}: ColophonTemplateContentProps) {
  switch (templateId) {
    case "center":
      return <CenterTemplate rows={rows} freeText={freeText} basePx={basePx} />;
    case "minimal":
      return (
        <MinimalTemplate
          rows={rows}
          freeText={freeText}
          basePx={basePx}
          titleFallback={titleFallback}
        />
      );
    case "classic":
      return <ClassicTemplate rows={rows} freeText={freeText} basePx={basePx} />;
    case "standard":
    default:
      return <StandardTemplate rows={rows} freeText={freeText} basePx={basePx} />;
  }
}

function FreeText({
  text,
  basePx,
  align = "left",
}: {
  text: string;
  basePx: number;
  align?: "left" | "center";
}) {
  if (text.trim() === "") return null;
  return (
    <p
      style={{
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        margin: 0,
        fontSize: `${basePx * 0.86}px`,
        textAlign: align,
        opacity: 0.85,
      }}
    >
      {text}
    </p>
  );
}

function StandardTemplate({
  rows,
  freeText,
  basePx,
}: {
  rows: ColophonRenderRow[];
  freeText: string;
  basePx: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: `${basePx * 1.4}px` }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          columnGap: `${basePx * 1.6}px`,
          rowGap: `${basePx * 0.7}px`,
        }}
      >
        {rows.map((row) => (
          <FragmentRow key={row.id} label={row.label} value={row.value} />
        ))}
      </div>
      <FreeText text={freeText} basePx={basePx} />
    </div>
  );
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span>{value}</span>
    </>
  );
}

function CenterTemplate({
  rows,
  freeText,
  basePx,
}: {
  rows: ColophonRenderRow[];
  freeText: string;
  basePx: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: `${basePx * 1.1}px`,
        textAlign: "center",
      }}
    >
      {rows.map((row) => (
        <div
          key={row.id}
          style={{ display: "flex", flexDirection: "column", gap: `${basePx * 0.15}px` }}
        >
          {row.label.trim() !== "" && (
            <span style={{ fontSize: `${basePx * 0.78}px`, opacity: 0.6 }}>
              {row.label}
            </span>
          )}
          <span>{row.value}</span>
        </div>
      ))}
      {freeText.trim() !== "" && <div style={{ height: `${basePx * 0.6}px` }} />}
      <FreeText text={freeText} basePx={basePx} align="center" />
    </div>
  );
}

function MinimalTemplate({
  rows,
  freeText,
  basePx,
  titleFallback,
}: {
  rows: ColophonRenderRow[];
  freeText: string;
  basePx: number;
  titleFallback: string;
}) {
  const titleRow = rows.find((row) => row.id === "title") ?? rows[0];
  const rest = rows.filter((row) => row !== titleRow);
  const mainTitle = (titleRow?.value ?? "").trim() || titleFallback;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: `${basePx * 2.4}px` }}>
      {mainTitle !== "" && (
        <div
          style={{
            fontSize: `${basePx * 1.7}px`,
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          {mainTitle}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: `${basePx * 0.4}px` }}>
        {rest.map((row) => (
          <div key={row.id} style={{ fontSize: `${basePx * 0.9}px`, opacity: 0.8 }}>
            {row.label.trim() !== "" ? `${row.label}：${row.value}` : row.value}
          </div>
        ))}
      </div>
      <FreeText text={freeText} basePx={basePx} />
    </div>
  );
}

function ClassicTemplate({
  rows,
  freeText,
  basePx,
}: {
  rows: ColophonRenderRow[];
  freeText: string;
  basePx: number;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.55)",
        padding: `${basePx * 1.1}px ${basePx * 1.3}px`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map((row, index) => (
          <div
            key={row.id}
            style={{
              display: "flex",
              gap: `${basePx * 1}px`,
              padding: `${basePx * 0.5}px 0`,
              borderBottom:
                index === rows.length - 1 ? "none" : "1px solid rgba(0,0,0,0.15)",
              fontWeight: row.id === "title" ? 600 : 400,
            }}
          >
            <span style={{ minWidth: `${basePx * 6}px`, opacity: 0.7 }}>{row.label}</span>
            <span style={{ flex: 1 }}>{row.value}</span>
          </div>
        ))}
      </div>
      {freeText.trim() !== "" && (
        <>
          <div
            style={{
              borderTop: "1px solid rgba(0,0,0,0.3)",
              margin: `${basePx * 0.9}px 0`,
            }}
          />
          <FreeText text={freeText} basePx={basePx} />
        </>
      )}
    </div>
  );
}
