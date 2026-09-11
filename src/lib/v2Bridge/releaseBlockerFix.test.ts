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

  it("sends only explicit feedback fields plus anti-abuse proof and permission-free environment diagnostics", () => {
    // Superseded by the final release fix's Feedback Environment Contract:
    // permission-free environment diagnostics ARE now sent automatically
    // (disclosed to the user, forwarded to Discord for debugging). What
    // must still never happen is creative content leaking out, and the
    // client must not read navigator/window directly — it only forwards
    // the environment object the modal already collected and displayed.
    const client = readSource("src/lib/betaFeedbackClient.ts");
    const modal = readSource("src/components/BetaFeedbackModal.tsx");
    expect(client).not.toMatch(/window\.location|navigator\./i);
    expect(client).toContain("clientContext: security.environment");
    expect(modal).toContain("collectFeedbackEnvironment");
    expect(client).not.toMatch(/manuscript|documentId|workTitle|原稿本文|作品タイトル|ドキュメントID/i);
    expect(client).toContain("message: submission.message");
    expect(client).toContain("checkedItems: submission.checkedItems");
    expect(client).toContain("note: submission.note");
    expect(client).toContain("turnstileToken");
    expect(client).toContain("FEEDBACK_HONEYPOT_FIELD");
  });

  it("discloses the feedback environment contract honestly: simple 3-field summary, no Discord mention, no false 'visible values only' claim", () => {
    const modal = readSource("src/components/BetaFeedbackModal.tsx");
    // The visible summary stays exactly 3 fields (Browser / Device / Viewport).
    expect(modal).toContain("feedbackUserVisibleRows");
    expect(modal).not.toContain("feedbackEnvironmentRows");
    // Discord is an internal implementation detail — never surfaced to the user.
    expect(modal).not.toMatch(/discord/i);
    // This claim is factually wrong once broader diagnostics are collected —
    // the internal payload always contains more than the 3 displayed fields.
    expect(modal).not.toContain("表示中の値のみ");
    // The disclosure must still say more is sent for debugging, and that
    // creative content is not.
    expect(modal).toContain("デバッグ用に自動送信される情報");
    expect(modal).toContain("原稿本文");
    expect(modal).toContain("作品タイトル");
    expect(modal).toContain("ドキュメントID");
  });
});

describe("Blocker 02 — long ruby centers over its base when the line has room on both sides", () => {
  // Proves FINAL CANONICAL PAINT-MODEL geometry (topPx/offsetPx/extentPx —
  // exactly what PreviewRenderer.tsx reads to paint the DOM), through the
  // REAL manuscript->v2 pipeline with REAL font-derived measurement, not the
  // abstract composeLine-only assertion in rubyPlacement.test.ts. Ordinary
  // text sits on both sides of the ruby, deliberately far from the line's
  // physical head/tail, so no clamp is expected — this is NOT the line-head
  // case (that one legitimately clamps and is covered separately).
  it("centers a mid-line 2-kanji base / 9-kana reading with ample room on both sides", () => {
    const bytes = new Uint8Array(readFileSync(resolve("public/fonts/ShipporiMincho-Regular.ttf")));
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const measurement = createShipporiMinchoMeasurementProviderFromBytes(bytes, sha256, "/fonts/ShipporiMincho-Regular.ttf");

    const content = "前前前｜東京《とうきょうていこく》後後後後後後後後後後後後後後後後後後後後";
    const settings = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 20, linesPerColumn: 4 };
    const bridge = composeV2Document({ title: "t", content, settings, measurement });
    const preview = buildV2PreviewDocument(bridge, {});

    const placedRubies = preview.pages
      .flatMap((page) => page.columns)
      .flatMap((column) => column.lines)
      .flatMap((line) => line.units)
      .filter((unit) => unit.rubyAnnotation?.status === "PLACED");

    expect(placedRubies).toHaveLength(1);
    const unit = placedRubies[0];
    const ann = unit.rubyAnnotation as Extract<typeof unit.rubyAnnotation, { status: "PLACED" }>;
    expect(ann.policy).toBe("CENTER");

    // Final rendered geometry: PreviewRenderer.tsx paints the annotation at
    // `top: unit.topPx + ann.offsetPx`, height `ann.extentPx`, inside the
    // base's own box at `top: unit.topPx`, height `unit.heightPx` — so this
    // is the exact arithmetic the DOM ends up with, not a paraphrase of it.
    const baseCenter = unit.topPx + unit.heightPx / 2;
    const annotationCenter = unit.topPx + ann.offsetPx + ann.extentPx / 2;
    expect(annotationCenter).toBeCloseTo(baseCenter, 3);
  });
});
