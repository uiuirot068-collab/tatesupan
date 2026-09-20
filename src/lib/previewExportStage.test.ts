import { describe, expect, it } from "vitest";
import {
  PREVIEW_EXPORT_STAGE_CLASS,
  shouldStagePreviewForExport,
} from "./previewExportStage";

describe("shouldStagePreviewForExport (TSP-UX-V3-LOOP3-MOBILE-SHARED-EXPORT)", () => {
  it("stages the Preview only while an export runs on the phone layout with the Preview not displayed", () => {
    expect(shouldStagePreviewForExport({ isNarrowViewport: true, mobileView: "editor", exporting: true })).toBe(true);
  });

  it("never stages when no export is running (the Preview stays display:none, exactly as before)", () => {
    expect(shouldStagePreviewForExport({ isNarrowViewport: true, mobileView: "editor", exporting: false })).toBe(false);
  });

  it("never touches the Preview when it is already the displayed phone workspace", () => {
    expect(shouldStagePreviewForExport({ isNarrowViewport: true, mobileView: "preview", exporting: true })).toBe(false);
  });

  it("never stages on the desktop layout (Preview is always laid out there)", () => {
    expect(shouldStagePreviewForExport({ isNarrowViewport: false, mobileView: "editor", exporting: true })).toBe(false);
    expect(shouldStagePreviewForExport({ isNarrowViewport: false, mobileView: "preview", exporting: true })).toBe(false);
  });
});

describe("PREVIEW_EXPORT_STAGE_CLASS", () => {
  const classes = PREVIEW_EXPORT_STAGE_CLASS.split(/\s+/);

  it("is entirely `max-md:` scoped so the desktop layout can never be affected", () => {
    expect(classes.length).toBeGreaterThan(0);
    for (const cls of classes) expect(cls.startsWith("max-md:")).toBe(true);
  });

  it("gives the Preview real layout but keeps it off-screen (fixed, far left)", () => {
    expect(classes).toContain("max-md:fixed");
    expect(classes).toContain("max-md:left-[-200vw]");
    expect(classes).toContain("max-md:flex");
  });

  it("does not use anything the capture would inherit or that would block the export overlay", () => {
    // html-to-image clones computed styles, so `visibility:hidden` / `opacity:0` would export a blank page;
    // pointer-events inherits into the (fixed) export progress overlay that lives inside the Preview.
    for (const forbidden of ["invisible", "opacity-0", "pointer-events-none", "hidden", "sr-only"]) {
      expect(classes.some((cls) => cls.replace("max-md:", "") === forbidden)).toBe(false);
    }
  });
});
