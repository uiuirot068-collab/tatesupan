import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS } from "../pageLayout";
import { createShipporiMinchoMeasurementProviderFromBytes } from "../../../typesetting-v2/core/measurement/shipporiMinchoProviderCore";
import { composeV2Document } from "./composeV2Document";
import { buildV2PreviewDocument } from "./useV2PreviewAdapter";

const source = (path: string) => readFileSync(resolve(path), "utf8");
const fontBytes = new Uint8Array(readFileSync(resolve("public/fonts/ShipporiMincho-Regular.ttf")));
const measurement = createShipporiMinchoMeasurementProviderFromBytes(
  fontBytes,
  createHash("sha256").update(fontBytes).digest("hex"),
  "/fonts/ShipporiMincho-Regular.ttf"
);

function compose(content: string) {
  const bridge = composeV2Document({
    title: "Empty Preview regression",
    content,
    settings: DEFAULT_PAGE_SETTINGS,
    measurement,
  });
  return { bridge, preview: buildV2PreviewDocument(bridge, {}) };
}

describe("empty manuscript Preview regression", () => {
  it("treats an empty canonical body as a valid non-HOLD blank Preview state", () => {
    const { bridge, preview } = compose("");

    expect(bridge.source).toBe("");
    expect(bridge.units).toEqual([]);
    expect(bridge.document.pages).toEqual([]);
    expect(bridge.document.hold).toBe(false);
    expect(bridge.document.errors).toEqual([]);
    expect(preview.pages).toEqual([]);
    expect(preview.hold).toBe(false);
  });

  it("keeps the physical PageCard blank instead of typesetting diagnostic copy", () => {
    const pageCard = source("src/components/PageCard.tsx");
    const missingPageBranch = pageCard.slice(
      pageCard.indexOf("v2PreviewPage ? ("),
      pageCard.indexOf(") : fullImage ? (")
    );

    expect(missingPageBranch).toContain('data-v2-preview-blank-surface=""');
    expect(missingPageBranch).toContain('aria-hidden="true"');
    expect(pageCard).not.toContain("Canonical Preview を準備できません");
    expect(pageCard).not.toContain("フォント資産を確認して再試行してください");
  });

  it("leaves normal manuscript Preview content on the existing canonical path", () => {
    const content = "通常の本文です。";
    const { bridge, preview } = compose(content);
    const paintedText = preview.pages
      .flatMap((page) => page.columns)
      .flatMap((column) => column.lines)
      .flatMap((line) => line.units)
      .map((unit) => unit.text)
      .join("");

    expect(bridge.document.pages.length).toBeGreaterThan(0);
    expect(preview.pages.length).toBe(bridge.document.pages.length);
    expect(paintedText).toContain("通常の本文です。");
  });

  it("keeps real adapter/font failures diagnosable outside manuscript content", () => {
    const adapter = source("src/lib/v2Bridge/useV2PreviewAdapter.ts");
    const previewPane = source("src/components/PreviewPane.tsx");
    const pageCard = source("src/components/PageCard.tsx");

    expect(adapter).toContain('error: `V2 HOLD: ${event.data.message ?? "Preview worker failed"}`');
    expect(adapter).toContain('error: `V2 HOLD: ${event.message || "Preview worker failed"}`');
    expect(previewPane).toContain("useV2Engine && v2Adapter.error");
    expect(previewPane).toContain('<div role="alert"');
    expect(previewPane).toContain("{v2Adapter.error} フォント資産を確認してから再読み込みしてください。");
    expect(pageCard).not.toContain("v2Adapter.error");
    expect(pageCard).not.toContain("V2 HOLD:");
  });
});
