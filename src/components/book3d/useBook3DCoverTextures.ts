"use client";

/**
 * CST-PORT-012: 表紙・裏表紙・背 for the 3D book.
 *
 * Drawn with the SAME plans and painter as the 表紙 screen and its export
 * (`buildCoverFacePlan` / `buildCoverSpreadPlan` + `paintCoverPlan`), then
 * cropped to the 仕上がり (no 塗り足し) — so the 3D shows exactly the cover
 * that would be exported. Only 「反映」した面 is shown, like CST.
 */
import { useEffect, useMemo, useState } from "react";
import { canvasCoverMeasure, ensureCoverFonts, loadCoverImage, paintCoverPlan } from "@/lib/cover/coverCanvas";
import { getCoverFaceGeometry, getCoverSpreadGeometry, roundSpineWidthMm } from "@/lib/cover/coverGeometry";
import { coverImageIds, type CoverSettings } from "@/lib/cover/coverModel";
import { buildCoverFacePlan, buildCoverSpreadPlan, type CoverPlan } from "@/lib/cover/coverPaint";

export type Book3DCoverTextures = {
  front: string | null;
  back: string | null;
  /** spine art (only when the spine width is set and a face is applied) */
  spine: string | null;
};

const NONE: Book3DCoverTextures = { front: null, back: null, spine: null };
/** Long side of a cover face texture (px). */
const COVER_TEXTURE_LONG_SIDE_PX = 1100;

/** Paints `plan` and cuts out `crop` (plan px) into a data URL at `scale`. */
function paintCropped(
  plan: CoverPlan,
  crop: { x: number; y: number; width: number; height: number },
  scale: number,
  images: Record<string, HTMLImageElement>,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = Math.max(1, Math.round(crop.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  // paintCoverPlan sets its own transform: paint the whole plan, then cut out the crop
  const full = document.createElement("canvas");
  full.width = Math.max(1, Math.round(plan.widthPx * scale));
  full.height = Math.max(1, Math.round(plan.heightPx * scale));
  const fullCtx = full.getContext("2d");
  if (!fullCtx) return "";
  paintCoverPlan(fullCtx, plan, scale, images);
  ctx.drawImage(full, Math.round(crop.x * scale), Math.round(crop.y * scale), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.9);
  full.width = 0;
  full.height = 0;
  canvas.width = 0;
  canvas.height = 0;
  return url;
}

export function useBook3DCoverTextures(
  cover: CoverSettings | undefined,
  paperSize: string,
  imageDataUrls: Record<string, string>,
  enabled: boolean,
): Book3DCoverTextures {
  const [textures, setTextures] = useState<Book3DCoverTextures>(NONE);
  const imageKey = useMemo(
    () =>
      coverImageIds(cover)
        .map((id) => `${id}:${imageDataUrls[id]?.length ?? 0}`)
        .join("|"),
    [cover, imageDataUrls],
  );

  const active = enabled && !!cover && (cover.frontApplied || cover.backApplied);

  useEffect(() => {
    if (!active || !cover) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const face = getCoverFaceGeometry(paperSize);
      const options = { measure: canvasCoverMeasure, showGuides: false };
      const trimCrop = {
        x: face.bleedMm * face.pxPerMm,
        y: face.bleedMm * face.pxPerMm,
        width: face.trimWidthMm * face.pxPerMm,
        height: face.trimHeightMm * face.pxPerMm,
      };
      const scale = COVER_TEXTURE_LONG_SIDE_PX / Math.max(trimCrop.width, trimCrop.height);
      const spineWidthMm = roundSpineWidthMm(cover.spine.widthMm);
      const spread = spineWidthMm > 0 ? getCoverSpreadGeometry(paperSize, spineWidthMm) : null;
      const plans = {
        front: cover.frontApplied ? buildCoverFacePlan(cover, "front", face, options) : null,
        back: cover.backApplied ? buildCoverFacePlan(cover, "back", face, options) : null,
        spread: spread ? buildCoverSpreadPlan(cover, spread, options) : null,
      };
      const used = [plans.front, plans.back, plans.spread].filter((plan): plan is CoverPlan => plan !== null);
      // fonts change the text widths: load them first, then build again
      if (await ensureCoverFonts(used)) {
        if (plans.front) plans.front = buildCoverFacePlan(cover, "front", face, options);
        if (plans.back) plans.back = buildCoverFacePlan(cover, "back", face, options);
        if (spread && plans.spread) plans.spread = buildCoverSpreadPlan(cover, spread, options);
      }
      const images: Record<string, HTMLImageElement> = {};
      await Promise.all(
        coverImageIds(cover).map(async (id) => {
          const url = imageDataUrls[id];
          if (!url) return;
          try {
            images[id] = await loadCoverImage(url);
          } catch {
            // a missing image paints nothing, like the 表紙 screen
          }
        }),
      );
      if (cancelled) return;
      const next: Book3DCoverTextures = {
        front: plans.front ? paintCropped(plans.front, trimCrop, scale, images) || null : null,
        back: plans.back ? paintCropped(plans.back, trimCrop, scale, images) || null : null,
        spine:
          spread && plans.spread
            ? paintCropped(
                plans.spread,
                {
                  x: spread.spine.x * spread.pxPerMm,
                  y: spread.bleedMm * spread.pxPerMm,
                  width: spread.spine.width * spread.pxPerMm,
                  height: face.trimHeightMm * spread.pxPerMm,
                },
                scale,
                images,
              ) || null
            : null,
      };
      setTextures(next);
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // imageKey stands for imageDataUrls' relevant part
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover, paperSize, imageKey, active]);

  return active ? textures : NONE;
}
