import { describe, expect, it } from "vitest";
import { resolvePublicationPdfPageOutput } from "../../../typesetting-v2/renderer/publication/pdfOutputGeometry";
import { createDefaultCoverSettings } from "./coverModel";
import { getCoverFaceGeometry } from "./coverGeometry";
import {
  COVER_PROOF_HINT,
  COVER_PROOF_LABEL,
  coverProofFileStem,
  coverProofImageBox,
  coverProofOrderText,
  coverProofPagesAround,
  coverProofPaintPage,
  coverProofSides,
  type CoverProofRaster,
} from "./coverProof";

// CST-PORT-013: 確認用PDF（表紙＋本文＋裏表紙）

const JPEG = new Uint8Array([0xff, 0xd8, 0xff]);
const face = getCoverFaceGeometry("A5");
const raster = (side: "front" | "back"): CoverProofRaster => ({
  side,
  jpeg: JPEG,
  trimWidthMm: face.trimWidthMm,
  trimHeightMm: face.trimHeightMm,
  bleedMm: face.bleedMm,
});

describe("確認用PDF の約束", () => {
  it("COLUMNSTAND と同じ名前・説明・保存名（_proof）", () => {
    expect(COVER_PROOF_LABEL).toBe("確認用PDF（表紙＋本文＋裏表紙）");
    expect(COVER_PROOF_HINT).toBe("読む順に1冊のPDFへ。背表紙はページとして入りません。印刷入稿用ではありません。");
    expect(coverProofFileStem("TateSpun20261003")).toBe("TateSpun20261003_proof");
  });

  it("反映した面だけを、表紙 → 裏表紙の順に入れる", () => {
    const cover = createDefaultCoverSettings();
    expect(coverProofSides(undefined)).toEqual([]);
    expect(coverProofSides(cover)).toEqual([]);
    expect(coverProofSides({ ...cover, backApplied: true })).toEqual(["back"]);
    expect(coverProofSides({ ...cover, frontApplied: true, backApplied: true })).toEqual(["front", "back"]);
  });

  it("並びの説明は未反映の面をそのまま知らせる（止めない）", () => {
    const cover = createDefaultCoverSettings();
    expect(coverProofOrderText({ ...cover, frontApplied: true, backApplied: true }, 12)).toBe(
      "表紙 → 本文（12ページ） → 裏表紙",
    );
    expect(coverProofOrderText({ ...cover, frontApplied: true }, 3)).toBe(
      "表紙 → 本文（3ページ） → （裏表紙は未反映）",
    );
    expect(coverProofOrderText(undefined, 1)).toContain("（表紙は未反映）");
  });

  it("表紙は前、裏表紙は後ろ（背表紙は入らない）", () => {
    const { leading, trailing } = coverProofPagesAround([raster("front"), raster("back")]);
    expect(leading.map((r) => r.side)).toEqual(["front"]);
    expect(trailing.map((r) => r.side)).toEqual(["back"]);
    expect(coverProofPagesAround([raster("back")]).leading).toEqual([]);
  });
});

describe("表紙のページの置き方", () => {
  it("ページは本文と同じ仕上がりの大きさ。画像は塗り足し込みの面全体を3mm外へはみ出して置く", () => {
    const page = coverProofPaintPage(raster("front"));
    expect(page.widthMm).toBe(148);
    expect(page.heightMm).toBe(210);
    expect(page.commands).toEqual([
      { op: "image", xMm: -3, yMm: -3, widthMm: 154, heightMm: 216, bytes: JPEG, format: "JPEG" },
    ]);
  });

  it("塗り足し込みPDFでは、はみ出した画像がちょうど塗り足しの枠に重なる", () => {
    const page = coverProofPaintPage(raster("back"));
    const output = resolvePublicationPdfPageOutput(page.widthMm, page.heightMm, "bleed");
    const image = page.commands[0];
    if (image.op !== "image") throw new Error("image expected");
    expect({
      xMm: image.xMm + output.contentOffsetXMm,
      yMm: image.yMm + output.contentOffsetYMm,
      widthMm: image.widthMm,
      heightMm: image.heightMm,
    }).toEqual(output.bleedBox);
  });

  it("仕上がりPDFではページ外の3mmが切れ、塗り足し込みPDF（旧方式）では原点から置く", () => {
    expect(coverProofImageBox(raster("front"), "trim")).toEqual({ xMm: -3, yMm: -3, widthMm: 154, heightMm: 216 });
    expect(coverProofImageBox(raster("front"), "bleed")).toEqual({ xMm: 0, yMm: 0, widthMm: 154, heightMm: 216 });
  });
});
