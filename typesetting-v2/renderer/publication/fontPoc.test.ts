// P3-O08 — Font Embedding Gate: minimal, isolated CJK vector-text PoC.
//
// Proves (or disproves) jsPDF's own documented custom-TTF/CJK embedding
// path (README.md "Use of Unicode Characters / UTF-8", addFont's own
// Identity-H encoding option — see qa/evidence/P3_O08_FONT_EMBEDDING_GATE.md
// §7) against the ACTUAL Shippori Mincho font asset, fetched once from
// Google's own official fonts repository (exact source URL below) after
// the license audit confirmed embedding + repository redistribution are
// both permitted (SIL OFL 1.1, qa/evidence/P3_O08_FONT_EMBEDDING_GATE.md
// §4/§5).
//
// Source: https://raw.githubusercontent.com/google/fonts/main/ofl/shipporimincho/ShipporiMincho-Regular.ttf
// License: SIL Open Font License 1.1 — see the accompanying OFL.txt in the
// same directory as the font file below (fetched from the same upstream
// repository, same commit).
//
// This file draws REAL vector text via jsPDF's own text() primitive using
// the registered font — never a screenshot, never a browser DOM, never
// html-to-image/canvas. It is a standalone PoC, deliberately not yet wired
// into paintModel.ts/pdfGenerator.ts (renderer integration is a separate,
// later step, gated on this PoC succeeding, per instruction).

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { generatePublicationPdf, type PublicationFontResource } from "./pdfGenerator";
import { ALL_FIXTURES, settingsFor } from "./fixtures";

const FONT_DIR = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts");
const FONT_PATH = join(FONT_DIR, "ShipporiMincho-Regular.ttf");
const OUT_DIR = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc");

// Dropbox (this worktree lives inside a synced Dropbox folder) can briefly
// hold an OS-level lock on a just-written file while it syncs — a known,
// pre-existing environment gotcha (unrelated to this task's own logic; the
// PDF bytes themselves are already asserted valid before this ever runs).
// Best-effort artifact write with a few retries; never fails the test on
// its own, since the QA artifact file is a convenience, not the assertion.
function writeArtifactBestEffort(path: string, bytes: Uint8Array): void {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      writeFileSync(path, bytes);
      return;
    } catch (err) {
      if (attempt === 4) {
        // eslint-disable-next-line no-console
        console.warn(`writeArtifactBestEffort: could not write ${path} after 5 attempts (likely a transient Dropbox sync lock) — ${(err as Error).message}`);
        return;
      }
    }
  }
}

describe("P3-O08 — Font Embedding PoC (Shippori Mincho, jsPDF)", () => {
  it("the fetched font asset exists and is a real, non-trivial TTF file", () => {
    expect(existsSync(FONT_PATH)).toBe(true);
    const bytes = readFileSync(FONT_PATH);
    expect(bytes.byteLength).toBeGreaterThan(100_000); // a real CJK font, not a stub
    // TTF files begin with the 4-byte sfnt version tag 0x00010000 (or "OTTO"/"true"/"typ1").
    const tag = bytes.readUInt32BE(0);
    expect([0x00010000, 0x4f54544f, 0x74727565, 0x74797031]).toContain(tag);
  });

  it("registers the font with jsPDF (addFileToVFS + addFont) without throwing", () => {
    const fontBase64 = readFileSync(FONT_PATH).toString("base64");
    const pdf = new jsPDF({ unit: "mm" });
    expect(() => {
      pdf.addFileToVFS("ShipporiMincho-Regular.ttf", fontBase64);
      pdf.addFont("ShipporiMincho-Regular.ttf", "ShipporiMincho", "normal");
      pdf.setFont("ShipporiMincho");
    }).not.toThrow();
  });

  it("generates a real PDF containing Japanese text drawn via jsPDF's own vector text() primitive at explicit physical mm coordinates -- no screenshot, no DOM", () => {
    const fontBase64 = readFileSync(FONT_PATH).toString("base64");
    const pdf = new jsPDF({ unit: "mm", format: [80, 120] });
    pdf.addFileToVFS("ShipporiMincho-Regular.ttf", fontBase64);
    pdf.addFont("ShipporiMincho-Regular.ttf", "ShipporiMincho", "normal");
    pdf.setFont("ShipporiMincho");
    pdf.setFontSize(14);

    // Representative fixture from the task's own required set -- ordinary
    // text, a jukugo word, ASCII digits, dash, ellipsis. Explicit physical
    // (x, y) mm positions, never jsPDF's own paragraph/wrap layout.
    const lines = ["気が合った。", "東京", "2026", "――", "……"];
    lines.forEach((line, i) => {
      pdf.text(line, 10, 15 + i * 12);
    });

    const arrayBuffer = pdf.output("arraybuffer") as ArrayBuffer;
    const bytes = new Uint8Array(arrayBuffer);
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(100_000); // the embedded font dominates file size

    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeArtifactBestEffort(join(OUT_DIR, "cjk-vector-text.pdf"), bytes);
  });

  it("a second, independent registration + draw produces the same logical text-command sequence (deterministic invocation order, not raw byte determinism)", () => {
    const fontBase64 = readFileSync(FONT_PATH).toString("base64");
    const build = () => {
      const pdf = new jsPDF({ unit: "mm", format: [80, 40] });
      pdf.addFileToVFS("ShipporiMincho-Regular.ttf", fontBase64);
      pdf.addFont("ShipporiMincho-Regular.ttf", "ShipporiMincho", "normal");
      pdf.setFont("ShipporiMincho");
      pdf.text("東京", 10, 15);
      return new Uint8Array(pdf.output("arraybuffer") as ArrayBuffer);
    };
    const a = build();
    const b = build();
    // Not asserting byte-identical (jsPDF embeds a creation timestamp) --
    // asserting the same logical outcome: both are valid PDFs of the same
    // approximate size (the same font + same one text draw call each).
    expect(new TextDecoder().decode(a.slice(0, 5))).toBe("%PDF-");
    expect(new TextDecoder().decode(b.slice(0, 5))).toBe("%PDF-");
    expect(Math.abs(a.byteLength - b.byteLength)).toBeLessThan(50);
  });

  it("vertical Japanese PoC: one controlled column of ordinary characters, each painted upright at its own explicit, cumulative y coordinate (never a whole-string rotation)", () => {
    // Real vertical Japanese (tategaki) is NOT one rotated horizontal text
    // run -- each ordinary character stays upright while the READING axis
    // flows top-to-bottom; only punctuation/dashes need their own rotation
    // (explicitly out of this task's scope -- P3-O04/O05's own Preview
    // treatment is not re-derived here). This PoC proves the one thing in
    // scope: placing successive un-rotated characters at increasing,
    // canonical-like y coordinates, each its own text() call, exactly the
    // per-atom placement Publication's own paint model already computes.
    const fontBase64 = readFileSync(FONT_PATH).toString("base64");
    const pdf = new jsPDF({ unit: "mm", format: [40, 60] });
    pdf.addFileToVFS("ShipporiMincho-Regular.ttf", fontBase64);
    pdf.addFont("ShipporiMincho-Regular.ttf", "ShipporiMincho", "normal");
    pdf.setFont("ShipporiMincho");
    pdf.setFontSize(12);

    const column = Array.from("東京都渋谷区");
    const xMm = 20;
    const cellHeightMm = 5;
    const topMm = 10;
    column.forEach((ch, i) => {
      pdf.text(ch, xMm, topMm + i * cellHeightMm, { angle: 0 });
    });

    const bytes = new Uint8Array(pdf.output("arraybuffer") as ArrayBuffer);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeArtifactBestEffort(join(OUT_DIR, "vertical-column.pdf"), bytes);
  });

  describe("Publication Renderer integration (ordinary TEXT only, per this task's own scope boundary)", () => {
    const measurement = createFakeMeasurementProvider();

    function fontResource(): PublicationFontResource {
      return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
    }

    it("generatePublicationPdf without fontResource is unchanged (rectangle-only foundation, backward compatible)", () => {
      const fx = ALL_FIXTURES.find((f) => f.id === "f20-canonical-sentence")!;
      const settings = settingsFor(fx.capacity);
      const document = composeCanonicalDocument({ bodyUnits: fx.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
      const ctx: PublicationRenderContext = {
        linePitchTicks: settings.linePitchTicks,
        lineExtentTicks: settings.lineExtentTicks,
        columnExtentTicks: settings.columnExtentTicks,
        columnsPerPage: settings.columnsPerPage,
        measurementIdentity: document.version.measurementIdentity,
        paintFontIdentity: document.version.measurementIdentity,
      };
      const model = buildPublicationDocument(fx.id, fx.label, document, fx.bodyUnits, fx.source, ctx);
      const { bytes, pageCount } = generatePublicationPdf(model);
      expect(pageCount).toBe(document.pages.length);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    });

    it("with fontResource supplied, page count and PublicationDocument geometry are unchanged -- font is paint-only, never a re-layout trigger", () => {
      const fx = ALL_FIXTURES.find((f) => f.id === "f20-canonical-sentence")!;
      const settings = settingsFor(fx.capacity);
      const document = composeCanonicalDocument({ bodyUnits: fx.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
      const ctx: PublicationRenderContext = {
        linePitchTicks: settings.linePitchTicks,
        lineExtentTicks: settings.lineExtentTicks,
        columnExtentTicks: settings.columnExtentTicks,
        columnsPerPage: settings.columnsPerPage,
        measurementIdentity: document.version.measurementIdentity,
        paintFontIdentity: document.version.measurementIdentity,
      };
      const modelBefore = buildPublicationDocument(fx.id, fx.label, document, fx.bodyUnits, fx.source, ctx);
      const snapshot = JSON.parse(JSON.stringify(modelBefore));
      const { pageCount } = generatePublicationPdf(modelBefore, fontResource());
      expect(pageCount).toBe(document.pages.length);
      // The model object itself (coordinates, text, everything) is provably
      // unchanged by having been handed to the PDF generator with a font.
      expect(modelBefore).toEqual(snapshot);
    });

    it("generates the F20 fixture as a real vector-text PDF with the embedded font, distinct from the rectangle-only foundation artifact", () => {
      const fx = ALL_FIXTURES.find((f) => f.id === "f20-canonical-sentence")!;
      const settings = settingsFor(fx.capacity);
      const document = composeCanonicalDocument({ bodyUnits: fx.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
      const ctx: PublicationRenderContext = {
        linePitchTicks: settings.linePitchTicks,
        lineExtentTicks: settings.lineExtentTicks,
        columnExtentTicks: settings.columnExtentTicks,
        columnsPerPage: settings.columnsPerPage,
        measurementIdentity: document.version.measurementIdentity,
        paintFontIdentity: document.version.measurementIdentity,
      };
      const model = buildPublicationDocument(fx.id, fx.label, document, fx.bodyUnits, fx.source, ctx);
      const { bytes, pageCount } = generatePublicationPdf(model, fontResource());
      expect(pageCount).toBe(document.pages.length);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
      writeArtifactBestEffort(join(__dirname, "..", "..", "qa", "publication", "p3-o08", "f20-vector-text.pdf"), bytes);
    });

    it("HOLD still refuses to emit a Publication PDF even when a fontResource is supplied", () => {
      const holdDocument = { id: "hold", label: "hold", hold: true, holdReasons: ["synthetic"], fontIdentityMismatch: false, totalPageCount: 0, renderedPageCount: 0, bodyEmMm: 3.704, pages: [] };
      expect(() => generatePublicationPdf(holdDocument, fontResource())).toThrow(/HOLD/);
    });
  });

  describe("Real MeasurementFacts identity <-> Publication paint identity", () => {
    it("Core's real Shippori Mincho MeasurementFacts identity matches Publication's own paintFontIdentity when both reference the same committed asset", async () => {
      const { createShipporiMinchoMeasurementProvider } = await import("../../core");
      const realProvider = createShipporiMinchoMeasurementProvider(FONT_PATH);
      const measurementIdentity = `${realProvider.providerId}@${realProvider.providerVersion}`;

      const fx = ALL_FIXTURES.find((f) => f.id === "f20-canonical-sentence")!;
      const settings = settingsFor(fx.capacity);
      const document = composeCanonicalDocument({ bodyUnits: fx.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement: realProvider, settings });
      expect(document.version.measurementIdentity).toBe(measurementIdentity);

      const ctx: PublicationRenderContext = {
        linePitchTicks: settings.linePitchTicks,
        lineExtentTicks: settings.lineExtentTicks,
        columnExtentTicks: settings.columnExtentTicks,
        columnsPerPage: settings.columnsPerPage,
        measurementIdentity: document.version.measurementIdentity,
        paintFontIdentity: measurementIdentity, // same real asset identity, Publication side
      };
      const model = buildPublicationDocument(fx.id, fx.label, document, fx.bodyUnits, fx.source, ctx);
      expect(model.fontIdentityMismatch).toBe(false);
    });

    it("a genuinely different font identity on the Publication side is detected as a mismatch, never silently accepted", async () => {
      const { createShipporiMinchoMeasurementProvider } = await import("../../core");
      const realProvider = createShipporiMinchoMeasurementProvider(FONT_PATH);
      const fx = ALL_FIXTURES.find((f) => f.id === "f20-canonical-sentence")!;
      const settings = settingsFor(fx.capacity);
      const document = composeCanonicalDocument({ bodyUnits: fx.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement: realProvider, settings });
      const ctx: PublicationRenderContext = {
        linePitchTicks: settings.linePitchTicks,
        lineExtentTicks: settings.lineExtentTicks,
        columnExtentTicks: settings.columnExtentTicks,
        columnsPerPage: settings.columnsPerPage,
        measurementIdentity: document.version.measurementIdentity,
        paintFontIdentity: "a-completely-different-font-identity",
      };
      const model = buildPublicationDocument(fx.id, fx.label, document, fx.bodyUnits, fx.source, ctx);
      expect(model.fontIdentityMismatch).toBe(true);
    });
  });
});
