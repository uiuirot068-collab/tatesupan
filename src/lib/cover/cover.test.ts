import { describe, expect, it } from "vitest";
import {
  coverApplyState,
  coverImageIds,
  createDefaultCoverSettings,
  normalizeCoverSettings,
  withApplyReset,
  type CoverSettings,
} from "./coverModel";
import {
  fitScale,
  getCoverFaceGeometry,
  getCoverSpreadGeometry,
  roundSpineWidthMm,
  spineTextState,
} from "./coverGeometry";
import {
  coverInlineSegments,
  coverPlainText,
  estimateSpineTextLengthMm,
  hasRubyMarkup,
  spineTextParts,
  verticalGlyphCount,
} from "./coverText";
import {
  COVER_EXPORT_DPI,
  COVER_EXPORT_MAX_CANVAS_PIXELS,
  coverExportAvailability,
  coverExportDpi,
  coverExportFileNames,
  coverFileName,
  coverSpineIssues,
  pxPerMmForDpi,
} from "./coverExport";
import {
  approximateCoverMeasure,
  backgroundFill,
  buildCoverFacePlan,
  frameLabelText,
  buildCoverSpreadPlan,
  coverPlanFonts,
  coverPlanImageIds,
  imageDestinationRect,
  layoutHorizontalLines,
  layoutVerticalColumns,
  patternPrimitives,
  type CoverPaintOp,
  type CoverPlan,
} from "./coverPaint";
import { keepCover, normalizeSettingsCover, settingsWithoutCover } from "./coverSettingsSync";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../pageLayout";

const measure = approximateCoverMeasure;
const options = { measure, showGuides: false };

function cover(patch: (base: CoverSettings) => CoverSettings = (base) => base): CoverSettings {
  return patch(createDefaultCoverSettings());
}

function glyphs(plan: CoverPlan): Extract<CoverPaintOp, { kind: "glyph" }>[] {
  return plan.ops.filter((op): op is Extract<CoverPaintOp, { kind: "glyph" }> => op.kind === "glyph");
}

describe("coverModel — COLUMNSTAND と同じデータの形", () => {
  it("空・壊れた値は既定値になる", () => {
    expect(normalizeCoverSettings(undefined)).toEqual(createDefaultCoverSettings());
    expect(normalizeCoverSettings("x")).toEqual(createDefaultCoverSettings());
  });

  it("保存するキーは CST の CoverSettings と同じ", () => {
    const value = createDefaultCoverSettings();
    expect(Object.keys(value).sort()).toEqual(
      ["back", "backApplied", "backSource", "front", "frontApplied", "frontSource", "simple", "spine", "templateId"].sort(),
    );
    expect(Object.keys(value.spine).sort()).toEqual(
      ["author", "color", "fontId", "fontSize", "freeText", "positionY", "textColor", "textMode", "title", "volume", "widthMm"].sort(),
    );
  });

  it("値の範囲と刻みを CST と同じに丸める", () => {
    const value = normalizeCoverSettings({
      templateId: "none",
      simple: {
        textColor: "red",
        lowerBandTop: 95,
        lowerBandHeight: 5,
        frontDesign: { imageOpacity: 15, patternScale: 30, patternRotation: 200, stripeThickness: 999, patternId: "zigzag", solidColor: "#12345" },
      },
      spine: { widthMm: 3.14159, fontSize: 2, positionY: 140, color: "#ABCDEF" },
    });
    expect(value.templateId).toBe("none");
    expect(value.simple.textColor).toBeNull();
    expect(value.simple.lowerBandTop).toBe(82);
    expect(value.simple.lowerBandHeight).toBe(18);
    expect(value.simple.frontDesign.imageOpacity).toBe(20);
    expect(value.simple.frontDesign.patternScale).toBe(25);
    expect(value.simple.frontDesign.patternRotation).toBe(180);
    expect(value.simple.frontDesign.stripeThickness).toBe(300);
    expect(value.simple.frontDesign.patternId).toBe("vertical-stripes");
    expect(value.simple.frontDesign.solidColor).toBe("#f7f2e8");
    expect(value.spine.widthMm).toBe(3.1);
    expect(value.spine.fontSize).toBe(4);
    expect(value.spine.positionY).toBe(100);
    expect(value.spine.color).toBe("#ABCDEF");
    expect(normalizeCoverSettings({ templateId: "mystery" }).templateId).toBeNull();
    expect(normalizeCoverSettings({ spine: { widthMm: -2, fontSize: 99 } }).spine).toMatchObject({ widthMm: 0, fontSize: 30 });
  });

  it("表紙の見た目が変わると表紙だけ「未反映」に戻る（背表紙の変更では戻らない）", () => {
    const applied = cover((base) => ({ ...base, frontApplied: true, backApplied: true, templateId: "vertical-pillar" }));
    const titled = withApplyReset(applied, { ...applied, simple: { ...applied.simple, title: "夜" } });
    expect(titled.frontApplied).toBe(false);
    expect(titled.backApplied).toBe(true);
    const spine = withApplyReset(applied, { ...applied, spine: { ...applied.spine, widthMm: 8 } });
    expect(spine.frontApplied).toBe(true);
    expect(spine.backApplied).toBe(true);
    const back = withApplyReset(applied, { ...applied, simple: { ...applied.simple, backTitle: "夜" } });
    expect(back.backApplied).toBe(false);
    expect(back.frontApplied).toBe(true);
  });

  it("テンプレートなしでも、裏表紙の文字を変えたら CST と同じく未反映に戻る", () => {
    const applied = cover((base) => ({ ...base, templateId: "none", backApplied: true }));
    const next = withApplyReset(applied, { ...applied, simple: { ...applied.simple, backTitle: "夜" } });
    expect(next.backApplied).toBe(false);
    const same = withApplyReset(applied, { ...applied });
    expect(same.backApplied).toBe(true);
  });

  it("面の状態: 配置済み / 未反映 / 未配置", () => {
    expect(coverApplyState(cover(), "front")).toBe("empty");
    expect(coverApplyState(cover((base) => ({ ...base, templateId: "lower-band" })), "front")).toBe("draft");
    expect(coverApplyState(cover((base) => ({ ...base, frontApplied: true })), "front")).toBe("applied");
    expect(coverApplyState(cover((base) => ({ ...base, simple: { ...base.simple, backAuthor: "a" } })), "back")).toBe("draft");
  });

  it("表紙画像の id を集める", () => {
    const ref = { assetId: "cover-front-1", fileName: "a.png", mimeType: "image/png", width: 10, height: 10, fit: "cover" as const };
    expect(coverImageIds(undefined)).toEqual([]);
    expect(coverImageIds(cover((base) => ({ ...base, front: ref })))).toEqual(["cover-front-1"]);
  });
});

describe("coverGeometry — 寸法（右綴じ: 表紙｜背｜裏表紙）", () => {
  it("A5 の1面は仕上がり 148×210 + 天地左右3mm", () => {
    const face = getCoverFaceGeometry("A5");
    expect(face.widthMm).toBe(154);
    expect(face.heightMm).toBe(216);
    expect(face.widthPx).toBeCloseTo(308);
    expect(face.pxPerMm).toBeCloseTo(2);
    expect(face.isPx).toBe(false);
  });

  it("見開きは 表紙(左)・背・裏表紙(右)。背との接合面に塗り足しなし", () => {
    const spread = getCoverSpreadGeometry("A5", 10);
    expect(spread.binding).toBe("right");
    expect(spread.left.side).toBe("front");
    expect(spread.right.side).toBe("back");
    expect(spread.widthMm).toBe(151 * 2 + 10);
    expect(spread.left.rect).toEqual({ x: 0, y: 0, width: 151, height: 216 });
    expect(spread.left.faceOffsetXMm).toBe(0);
    expect(spread.right.rect.x).toBe(161);
    expect(spread.right.faceOffsetXMm).toBe(-3);
    expect(spread.spine).toEqual({ x: 151, y: 0, width: 10, height: 216 });
    expect(spread.trim).toEqual({ x: 3, y: 3, width: 306, height: 210 });
    expect(spread.foldXsMm).toEqual([151, 161]);
  });

  it("背幅 0 でも見開きは作れる（折り位置は1本）", () => {
    const spread = getCoverSpreadGeometry("文庫", 0);
    expect(spread.foldXsMm[0]).toBe(spread.foldXsMm[1]);
    expect(spread.widthMm).toBe((spread.face.trimWidthMm + 3) * 2);
  });

  it("背文字: 4mm 未満は置かない、6mm 未満は細幅", () => {
    expect(spineTextState(3.9)).toBe("disabled");
    expect(spineTextState(4)).toBe("narrow");
    expect(spineTextState(5.9)).toBe("narrow");
    expect(spineTextState(6)).toBe("ready");
    expect(roundSpineWidthMm(Number.NaN)).toBe(0);
    expect(roundSpineWidthMm(12.345)).toBe(12.3);
  });

  it("Web閲覧用は px の用紙として扱う", () => {
    expect(getCoverFaceGeometry("Web閲覧用").isPx).toBe(true);
  });

  it("画面に収める倍率", () => {
    expect(fitScale(200, 100, 100, 100)).toBe(0.5);
    expect(fitScale(0, 100, 100, 100)).toBe(1);
  });
});

describe("coverText — 縦中横・ルビ", () => {
  it("2桁の数字と [tate] は縦中横、3桁は違う、ルビは親文字だけ", () => {
    expect(coverInlineSegments("第12話")).toEqual([
      { kind: "text", value: "第" },
      { kind: "tcy", value: "12" },
      { kind: "text", value: "話" },
    ]);
    expect(coverInlineSegments("123").every((segment) => segment.kind === "text")).toBe(true);
    expect(coverInlineSegments("[tate]A5[/tate]判")).toEqual([
      { kind: "tcy", value: "A5" },
      { kind: "text", value: "判" },
    ]);
    expect(coverPlainText("｜夜空《よぞら》の12")).toBe("夜空の12");
    expect(hasRubyMarkup("｜夜空《よぞら》")).toBe(true);
    expect(verticalGlyphCount("第12話")).toBe(3);
  });

  it("背文字の並び: 項目ごと／自由入力（空行は詰める）", () => {
    expect(spineTextParts({ textMode: "template", title: "夜", volume: " ", author: "猫", freeText: "x" })).toEqual(["夜", "猫"]);
    expect(spineTextParts({ textMode: "free", title: "x", volume: "", author: "", freeText: "夜\n\n猫" })).toEqual(["夜", "猫"]);
    expect(estimateSpineTextLengthMm([], 3)).toBe(0);
    expect(estimateSpineTextLengthMm(["夜空", "猫"], 4)).toBeCloseTo(3 * 4 * 1.08 + 4);
  });
});

describe("coverExport — 何を・どの名前で書き出せるか", () => {
  const both = cover((base) => ({ ...base, frontApplied: true, backApplied: true }));

  it("別々の書き出しは背幅がなくても、反映した面だけを書き出す", () => {
    expect(coverExportAvailability("cover-separate", cover()).ok).toBe(false);
    const front = cover((base) => ({ ...base, frontApplied: true }));
    expect(coverExportAvailability("cover-separate", front)).toEqual({ sides: ["front"], ok: true, reason: "" });
    expect(coverExportAvailability("cover-separate", both).sides).toEqual(["front", "back"]);
    expect(coverExportAvailability("cover-front", both).sides).toEqual(["front"]);
  });

  it("見開きは両面の反映と背幅が要る", () => {
    expect(coverExportAvailability("cover-spread", cover((base) => ({ ...base, frontApplied: true }))).ok).toBe(false);
    const noSpine = coverExportAvailability("cover-spread", both);
    expect(noSpine.ok).toBe(false);
    expect(noSpine.reason).toContain("背幅が未入力");
    const withSpine = { ...both, spine: { ...both.spine, widthMm: 8 } };
    expect(coverExportAvailability("cover-spread", withSpine).ok).toBe(true);
  });

  it("ファイル名は半角の役割名付き", () => {
    expect(coverFileName.face("tatespun", "front", "pdf")).toBe("tatespun_front.pdf");
    expect(coverFileName.spread("tatespun", "jpg")).toBe("tatespun_cover_spread.jpg");
    expect(coverFileName.zip("tatespun")).toBe("tatespun_cover.zip");
    expect(coverExportFileNames("cover-separate", both, "book", "jpg")).toEqual(["book_front.jpg", "book_back.jpg"]);
    expect(coverExportFileNames("cover-spread", both, "book", "jpg")).toEqual([]);
  });

  it("350dpi。iPhone の canvas 上限を超える大きな見開きだけ解像度を下げる", () => {
    const face = getCoverFaceGeometry("A5");
    expect(coverExportDpi(face.widthMm, face.heightMm)).toBe(COVER_EXPORT_DPI);
    const spread = getCoverSpreadGeometry("B5", 20);
    const dpi = coverExportDpi(spread.widthMm, spread.heightMm);
    expect(dpi).toBeLessThan(COVER_EXPORT_DPI);
    const pixels = spread.widthMm * pxPerMmForDpi(dpi) * spread.heightMm * pxPerMmForDpi(dpi);
    expect(pixels).toBeLessThanOrEqual(COVER_EXPORT_MAX_CANVAS_PIXELS);
  });

  it("背文字の注意（大きすぎ・安全域・ルビ）", () => {
    const narrow = cover((base) => ({ ...base, spine: { ...base.spine, widthMm: 5, fontSize: 14, title: "｜夜《よる》" } }));
    const issues = coverSpineIssues(narrow, "A5");
    expect(issues.some((issue) => issue.includes("大きすぎ"))).toBe(true);
    expect(issues.some((issue) => issue.includes("ルビ"))).toBe(true);
    const edge = cover((base) => ({ ...base, spine: { ...base.spine, widthMm: 10, fontSize: 8, title: "夜", positionY: 2 } }));
    expect(coverSpineIssues(edge, "A5").some((issue) => issue.includes("安全域"))).toBe(true);
    const fine = cover((base) => ({ ...base, spine: { ...base.spine, widthMm: 10, fontSize: 8, title: "夜" } }));
    expect(coverSpineIssues(fine, "A5")).toEqual([]);
    const thin = cover((base) => ({ ...base, spine: { ...base.spine, widthMm: 2, fontSize: 20, title: "夜" } }));
    expect(coverSpineIssues(thin, "A5")).toEqual([]);
  });
});

describe("coverPaint — 描画命令（プレビューと書き出しで共通）", () => {
  const face = getCoverFaceGeometry("A5");
  const safe = (face.bleedMm + face.safeMm) * face.pxPerMm;

  it("背景 → 重ねるもの → テンプレの順。ガイドはプレビューだけ", () => {
    const patterned = cover((base) => ({
      ...base,
      simple: { ...base.simple, frontDesign: { ...base.simple.frontDesign, foregroundType: "pattern" } },
    }));
    const plan = buildCoverFacePlan(patterned, "front", face, options);
    expect(plan.ops[0]).toMatchObject({ kind: "fill", rect: { x: 0, y: 0 } });
    expect(plan.ops[1].kind).toBe("pattern");
    expect(plan.ops.some((op) => op.kind === "strokeRect" && op.dash)).toBe(false);
    const preview = buildCoverFacePlan(patterned, "front", face, { measure, showGuides: true });
    const guide = preview.ops.at(-1);
    expect(guide).toMatchObject({ kind: "strokeRect", dash: [4, 3] });
  });

  it("テンプレートなしは文字も帯も描かない（表紙・裏表紙とも）", () => {
    const none = cover((base) => ({ ...base, templateId: "none", simple: { ...base.simple, backTitle: "夜" } }));
    expect(glyphs(buildCoverFacePlan(none, "front", face, options))).toEqual([]);
    expect(glyphs(buildCoverFacePlan(none, "back", face, options))).toEqual([]);
    expect(buildCoverFacePlan(none, "front", face, options).ops).toHaveLength(1);
  });

  it("縦柱: タイトルは安全域の中、右上から縦に並び、長いと左の列へ折り返す", () => {
    const value = cover((base) => ({ ...base, simple: { ...base.simple, title: "あ".repeat(30) } }));
    const plan = buildCoverFacePlan(value, "front", face, options);
    const title = glyphs(plan).filter((op) => op.font.sizePx === 19);
    expect(title).toHaveLength(30);
    const xs = Array.from(new Set(title.map((op) => Math.round(op.x * 100))));
    expect(xs.length).toBeGreaterThan(1);
    expect(title[0].x).toBeGreaterThan(title.at(-1)!.x);
    for (const op of title) {
      expect(op.x).toBeLessThanOrEqual(face.widthPx - safe);
      expect(op.y).toBeGreaterThanOrEqual(safe);
      expect(op.y).toBeLessThanOrEqual(face.heightPx - safe);
    }
    const contentHeight = face.heightPx - safe * 2;
    const firstColumn = title.filter((op) => Math.round(op.x * 100) === xs[0]);
    expect(firstColumn.at(-1)!.y - safe).toBeLessThanOrEqual(contentHeight * 0.56);
  });

  it("縦柱を左にすると帯と文字が左へ移る", () => {
    const right = buildCoverFacePlan(cover(), "front", face, options);
    const left = buildCoverFacePlan(cover((base) => ({ ...base, simple: { ...base.simple, pillarSide: "left" } })), "front", face, options);
    const firstTitle = (plan: CoverPlan) => glyphs(plan).find((op) => op.font.sizePx === 19)!;
    expect(firstTitle(right).x).toBeGreaterThan(face.widthPx / 2);
    expect(firstTitle(left).x).toBeLessThan(face.widthPx / 2);
  });

  it("縦組み: 縦中横は1マス、半角英字は横倒し、句読点は縦用の字形", () => {
    const value = cover((base) => ({ ...base, simple: { ...base.simple, title: "第12話A、" } }));
    const title = glyphs(buildCoverFacePlan(value, "front", face, options)).filter((op) => op.font.sizePx === 19);
    expect(title.map((op) => op.mode)).toEqual(["upright", "tcy", "upright", "rotated", "upright"]);
    expect(title[1].text).toBe("12");
    expect(title[4].text).toBe("︑");
  });

  it("下帯: 文字は帯の中（安全域の内側）に収まる", () => {
    const value = cover((base) => ({ ...base, templateId: "lower-band", simple: { ...base.simple, title: "夜の図書館", author: "猫" } }));
    const plan = buildCoverFacePlan(value, "front", face, options);
    const bandTop = 0.66 * face.heightPx;
    const bandBottom = bandTop + 0.24 * face.heightPx;
    for (const op of glyphs(plan)) {
      expect(op.y).toBeGreaterThan(bandTop);
      expect(op.y).toBeLessThan(bandBottom);
      expect(op.x).toBeGreaterThanOrEqual(safe - 0.01);
      expect(op.color).toBe("#ffffff");
    }
  });

  it("額縁ラベル: タイトル・サブタイトルは中央、著者名は下の丸いラベル", () => {
    const value = cover((base) => ({ ...base, templateId: "frame-label", simple: { ...base.simple, title: "夜", author: "猫" } }));
    const plan = buildCoverFacePlan(value, "front", face, options);
    const title = glyphs(plan).find((op) => op.font.sizePx === 18)!;
    expect(title.x + 9).toBeCloseTo(face.widthPx / 2, 0);
    const pill = plan.ops.find((op) => op.kind === "fill" && op.radius);
    expect(pill).toBeDefined();
  });

  it("額縁ラベル: スペースだけの欄は空欄（文字も白い台紙も出さない）、未入力は見本の文字", () => {
    const fills = (plan: ReturnType<typeof buildCoverFacePlan>) => plan.ops.filter((op) => op.kind === "fill");
    const withAll = buildCoverFacePlan(cover((base) => ({ ...base, templateId: "frame-label", simple: { ...base.simple, title: "夜", subtitle: "朝", author: "猫" } })), "front", face, options);
    // 背景 + ラベル台紙 + 著者名の丸い台紙
    expect(fills(withAll)).toHaveLength(3);

    const noAuthor = buildCoverFacePlan(cover((base) => ({ ...base, templateId: "frame-label", simple: { ...base.simple, title: "夜", subtitle: "朝", author: " " } })), "front", face, options);
    expect(noAuthor.ops.find((op) => op.kind === "fill" && op.radius)).toBeUndefined();
    expect(glyphs(noAuthor).map((op) => op.text).join("")).toBe("夜朝");

    const fullWidthSpace = buildCoverFacePlan(cover((base) => ({ ...base, templateId: "frame-label", simple: { ...base.simple, title: "夜", subtitle: "\u3000", author: "猫" } })), "front", face, options);
    expect(fullWidthSpace.ops.some((op) => op.kind === "line")).toBe(false);
    expect(glyphs(fullWidthSpace).map((op) => op.text).join("")).toBe("夜猫");

    const allBlank = buildCoverFacePlan(cover((base) => ({ ...base, templateId: "frame-label", simple: { ...base.simple, title: " ", subtitle: " ", author: " " } })), "front", face, options);
    expect(fills(allBlank)).toHaveLength(1);
    expect(glyphs(allBlank)).toEqual([]);

    expect(frameLabelText("", "著者名")).toBe("著者名");
    expect(frameLabelText("  ", "著者名")).toBeNull();
    expect(frameLabelText(" 猫 ", "著者名")).toBe(" 猫 ");
  });

  it("裏表紙: 文字がなければ何も足さない。文字は中央に横書き", () => {
    expect(glyphs(buildCoverFacePlan(cover(), "back", face, options))).toEqual([]);
    const value = cover((base) => ({ ...base, simple: { ...base.simple, backTitle: "夜", backPanelEnabled: false } }));
    const plan = buildCoverFacePlan(value, "back", face, options);
    expect(glyphs(plan)).toHaveLength(1);
    expect(glyphs(plan)[0].mode).toBe("horizontal");
    expect(plan.ops.filter((op) => op.kind === "fill")).toHaveLength(1);
  });

  it("文字色はテンプレ既定か、指定した色", () => {
    const value = cover((base) => ({ ...base, simple: { ...base.simple, textColor: "#aa0000" } }));
    expect(glyphs(buildCoverFacePlan(value, "front", face, options)).every((op) => op.color === "#aa0000")).toBe(true);
    expect(glyphs(buildCoverFacePlan(cover(), "front", face, options)).every((op) => op.color === "#16131a")).toBe(true);
  });

  it("画像の置き方: 全面に敷く／全体を収める／中央配置（原寸・はみ出すときだけ縮める）", () => {
    const rect = { x: 0, y: 0, width: 100, height: 200 };
    expect(imageDestinationRect("cover", 100, 100, rect, 2)).toEqual({ x: -50, y: 0, width: 200, height: 200 });
    expect(imageDestinationRect("contain", 100, 100, rect, 2)).toEqual({ x: 0, y: 50, width: 100, height: 100 });
    const center = imageDestinationRect("center", 138, 138, rect, 2);
    expect(center.width).toBeCloseTo(138 * (25.4 / 350) * 2);
    expect(imageDestinationRect("center", 4000, 4000, rect, 2).width).toBeCloseTo(100);
  });

  it("画像の op は id と不透明度を持つ", () => {
    const ref = { assetId: "cover-front-x", fileName: "a.png", mimeType: "image/png", width: 300, height: 400, fit: "cover" as const };
    const value = cover((base) => ({
      ...base,
      front: ref,
      simple: { ...base.simple, frontDesign: { ...base.simple.frontDesign, foregroundType: "image", imageOpacity: 40 } },
    }));
    const plan = buildCoverFacePlan(value, "front", face, options);
    expect(plan.ops[1]).toMatchObject({ kind: "image", assetId: "cover-front-x", opacity: 0.4 });
    expect(coverPlanImageIds(plan)).toEqual(["cover-front-x"]);
  });

  it("グラデーションは CSS の linear-gradient と同じ向き", () => {
    const rect = { x: 0, y: 0, width: 100, height: 200 };
    const base = createDefaultCoverSettings().simple.frontDesign;
    const vertical = backgroundFill({ ...base, backgroundType: "gradient" }, rect);
    expect(vertical).toMatchObject({ type: "linear", x0: 50, y0: 0, x1: 50, y1: 200 });
    const horizontal = backgroundFill({ ...base, backgroundType: "gradient", gradientDirection: "horizontal" }, rect);
    expect(horizontal).toMatchObject({ x0: 0, x1: 100 });
  });

  it("模様: 回しても面の四隅まで敷き詰める（隅に隙間が出ない）", () => {
    const rect = { x: 0, y: 0, width: 300, height: 420 };
    const base = createDefaultCoverSettings().simple.frontDesign;
    for (const patternId of ["vertical-stripes", "diagonal-stripes", "grid", "checkerboard", "dots"] as const) {
      for (const patternRotation of [0, 45, 90, 135]) {
        const primitives = patternPrimitives({ ...base, patternId, patternRotation }, rect);
        const xs = [...primitives.polygons.flatMap((p) => p.filter((_, i) => i % 2 === 0)), ...primitives.circles.map((c) => c[0])];
        const ys = [...primitives.polygons.flatMap((p) => p.filter((_, i) => i % 2 === 1)), ...primitives.circles.map((c) => c[1])];
        expect(Math.min(...xs)).toBeLessThanOrEqual(0);
        expect(Math.max(...xs)).toBeGreaterThanOrEqual(300);
        expect(Math.min(...ys)).toBeLessThanOrEqual(0);
        expect(Math.max(...ys)).toBeGreaterThanOrEqual(420);
      }
    }
  });

  it("模様: 不透明度は色に、サイズは周期に効く（面全体は拡大しない）", () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    const base = createDefaultCoverSettings().simple.frontDesign;
    const small = patternPrimitives({ ...base, patternScale: 100 }, rect);
    const big = patternPrimitives({ ...base, patternScale: 400, patternOpacity: 30 }, rect);
    expect(big.polygons.length).toBeLessThan(small.polygons.length);
    expect(big.color).toBe("rgba(122, 100, 130, 0.3)");
  });

  it("見開き: 表紙を左の窓、裏表紙を右の窓に置き、背の中央に背文字を1本", () => {
    const value = cover((base) => ({
      ...base,
      simple: { ...base.simple, backTitle: "裏" },
      spine: { ...base.spine, widthMm: 10, title: "夜の図書館", author: "猫", positionY: 50 },
    }));
    const spread = getCoverSpreadGeometry("A5", 10);
    const plan = buildCoverSpreadPlan(value, spread, options);
    // 面の窓は天地いっぱいの clip（テンプレート内の clip は除く）
    const clips = plan.ops.filter((op) => op.kind === "clip" && op.rect.y === 0 && op.rect.height === spread.heightPx);
    expect(clips[0]).toMatchObject({ rect: { x: 0, width: 151 * spread.pxPerMm } });
    expect(clips[1].kind === "clip" && clips[1].rect.x).toBeCloseTo(161 * spread.pxPerMm, 6);
    const spineCenter = 156 * spread.pxPerMm;
    const spineGlyphs = glyphs(plan).filter((op) => Math.abs(op.x - spineCenter) < 0.01);
    expect(spineGlyphs.map((op) => op.text).join("")).toBe("夜の図書館猫");
    const ys = spineGlyphs.map((op) => op.y);
    const middle = (Math.min(...ys) + Math.max(...ys)) / 2;
    expect(middle).toBeCloseTo(spread.heightPx / 2, -1);
    expect(spineGlyphs[0].font.weight).toBe(600);
    expect(spineGlyphs.at(-1)!.font.weight).toBe(400);
    const backTitle = glyphs(plan).find((op) => op.text === "裏")!;
    expect(backTitle.x).toBeGreaterThan(161 * spread.pxPerMm);
  });

  it("見開き: 背幅 4mm 未満は背色だけ（背文字なし）", () => {
    const value = cover((base) => ({ ...base, templateId: "none", spine: { ...base.spine, widthMm: 3, title: "夜" } }));
    const plan = buildCoverSpreadPlan(value, getCoverSpreadGeometry("A5", 3), options);
    expect(glyphs(plan)).toEqual([]);
    expect(plan.ops.some((op) => op.kind === "fill" && op.fill.type === "solid" && op.fill.color === "#ffffff")).toBe(true);
  });

  it("使うフォントと文字を集める（描く前に読み込むため）", () => {
    const fonts = coverPlanFonts(buildCoverFacePlan(cover((base) => ({ ...base, simple: { ...base.simple, title: "夜夜" } })), "front", face, options));
    const mincho = fonts.find((entry) => entry.font.weight === 500)!;
    expect(mincho.text).toBe("夜");
  });

  it("横組みの折り返し・縦組みの列", () => {
    const font = { family: "x", sizePx: 10, weight: 400 };
    const lines = layoutHorizontalLines("あいうえお", font, 0, 25, measure);
    expect(lines.map((line) => line.glyphs.length)).toEqual([2, 2, 1]);
    const columns = layoutVerticalColumns("あいうえお", font, 0, 25, measure);
    expect(columns.map((column) => column.glyphs.length)).toEqual([2, 2, 1]);
  });
});

describe("coverSettingsSync — 作品設定とのつなぎ目", () => {
  const withCover: PageSettings = { ...DEFAULT_PAGE_SETTINGS, cover: createDefaultCoverSettings() };

  it("組版に渡す settings から cover を外す（中身はそのまま）", () => {
    const stripped = settingsWithoutCover(withCover);
    expect("cover" in stripped).toBe(false);
    expect(settingsWithoutCover(DEFAULT_PAGE_SETTINGS)).toBe(DEFAULT_PAGE_SETTINGS);
    expect(JSON.stringify(settingsWithoutCover({ ...withCover, cover: { ...withCover.cover!, frontApplied: true } }))).toBe(
      JSON.stringify(stripped),
    );
  });

  it("cover のない変更（プレビューのノンブル非表示など）でも表紙を消さない", () => {
    const next = { ...settingsWithoutCover(withCover), pageOverrides: { 3: { hideNombre: true } } };
    const merged = keepCover(withCover, next);
    expect(merged.cover).toBe(withCover.cover);
    expect(merged.pageOverrides).toEqual({ 3: { hideNombre: true } });
  });

  it("読み込んだ cover を正しい形にそろえる", () => {
    expect(normalizeSettingsCover(DEFAULT_PAGE_SETTINGS)).toBe(DEFAULT_PAGE_SETTINGS);
    const broken = { ...DEFAULT_PAGE_SETTINGS, cover: null } as unknown as PageSettings;
    expect("cover" in normalizeSettingsCover(broken)).toBe(false);
    const partial = { ...DEFAULT_PAGE_SETTINGS, cover: { spine: { widthMm: 7.77 } } } as unknown as PageSettings;
    expect(normalizeSettingsCover(partial).cover?.spine.widthMm).toBe(7.8);
  });
});
