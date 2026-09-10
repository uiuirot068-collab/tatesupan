import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS } from "../pageLayout";
import { composeV2Document } from "./composeV2Document";
import { buildV2PreviewDocument } from "./useV2PreviewAdapter";
import { createShipporiMinchoMeasurementProviderFromBytes } from "../../../typesetting-v2/core/measurement/shipporiMinchoProviderCore";
import { PREVIEW_RENDERER_STYLES } from "../../../typesetting-v2/renderer/preview/PreviewRenderer";

const readSource = (path: string) => readFileSync(resolve(path), "utf8");

describe("Beta release blocker contracts", () => {
  it("keeps both rollout engines inside the approved PreviewPane product shell", () => {
    const preview = readSource("src/components/PreviewPane.tsx");
    expect(preview).toContain("useV2PreviewAdapter(useV2Engine");
    expect(preview).toContain("v2PreviewPage={useV2Engine ? v2BodyPreviewPages[bodyIndex] : undefined}");
    expect(preview).not.toContain("<PreviewPaneNew");
    expect(preview).not.toContain('from "./PreviewPaneNew"');
    expect(preview).toContain("data-demo-target=\"export\"");
    expect(preview).toContain("onClick={zoomIn}");
    expect(preview).toContain("stableToggleCheckbox(bodyIndex)");
    expect(preview).toContain("stableMovePageBackward(bodyIndex)");
  });

  it("exports only renderer-root-scoped embedded CSS", () => {
    for (const selector of ["body", "*", "h1", ".page"]) {
      expect(PREVIEW_RENDERER_STYLES).not.toMatch(new RegExp(`(^|\\n)\\s*${selector.replace("*", "\\*")}\\s*\\{`));
    }
    expect(PREVIEW_RENDERER_STYLES).toContain(":where([data-v2-preview-root]) .page");
    expect(PREVIEW_RENDERER_STYLES).toContain(":where([data-v2-preview-root]) body");
  });

  it("uses one real font-derived composition for Preview/PDF/JPG geometry", () => {
    const bytes = new Uint8Array(readFileSync(resolve("public/fonts/ShipporiMincho-Regular.ttf")));
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const measurement = createShipporiMinchoMeasurementProviderFromBytes(bytes, sha256, "/fonts/ShipporiMincho-Regular.ttf");
    const bridge = composeV2Document({
      title: "Parity",
      content: "縦書き本文。".repeat(180),
      settings: { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 12, linesPerColumn: 4 },
      measurement,
    });
    const preview = buildV2PreviewDocument(bridge, {});
    expect(measurement.providerId).toBe("tatespun-shippori-mincho-real-measurement-provider");
    expect(bridge.plan).toHaveLength(bridge.document.pageSequence.length);
    expect(preview.pages).toHaveLength(bridge.plan.length);
    expect(preview.pages.map((page) => page.columns.length)).toEqual(
      bridge.document.pageSequence.map((ref) =>
        ref.kind === "body"
          ? bridge.document.pages[ref.index].columns.length
          : bridge.document.colophon?.pages[ref.index].columns.length
      )
    );
    expect(readSource("src/lib/v2Bridge/useV2PreviewAdapter.ts")).not.toContain("createFakeMeasurementProvider");
    expect(readSource("src/components/PreviewPane.tsx")).not.toContain("createFakeMeasurementProvider");
  });

  it("fails closed for malformed font bytes and leaves the browser loader retryable", () => {
    expect(() => createShipporiMinchoMeasurementProviderFromBytes(new Uint8Array([1, 2, 3]), "0".repeat(64), "bad.ttf"))
      .toThrow(/truncated|malformed/i);
    const loader = readSource("src/lib/v2Bridge/browserMeasurementProvider.ts");
    expect(loader).not.toContain("fakeProvider");
    expect(loader).toContain("providerPromise = null");
    expect(loader).toContain("throw error");
  });

  it("removes public Renderer PoC route entrypoints", () => {
    expect(existsSync(resolve("src/app/renderer-poc/page.tsx"))).toBe(false);
    expect(existsSync(resolve("src/app/renderer-poc/jpg-export/page.tsx"))).toBe(false);
  });

  it("sends only explicit feedback fields plus anti-abuse proof", () => {
    const client = readSource("src/lib/betaFeedbackClient.ts");
    const modal = readSource("src/components/BetaFeedbackModal.tsx");
    expect(client).not.toMatch(/clientContext|appVersion|viewport|window\.location|navigator\./i);
    expect(modal).not.toMatch(/collectFeedbackEnvironment|appendEnvironmentBlock|envSummary|envDetail/);
    expect(client).toContain("message: submission.message");
    expect(client).toContain("checkedItems: submission.checkedItems");
    expect(client).toContain("note: submission.note");
    expect(client).toContain("turnstileToken");
    expect(client).toContain("FEEDBACK_HONEYPOT_FIELD");
  });
});
