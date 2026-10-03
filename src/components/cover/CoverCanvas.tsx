"use client";

/**
 * CST-PORT-011: 表紙の描画命令を画面に描く canvas。
 * 書き出しと同じ paintCoverPlan を使い、倍率だけを画面に合わせる。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CoverMeasure, CoverPlan } from "@/lib/cover/coverPaint";
import {
  canvasCoverMeasure,
  ensureCoverFonts,
  loadCoverImage,
  paintCoverPlan,
  type CoverImageSources,
} from "@/lib/cover/coverCanvas";

/**
 * 描画命令を作る。使うフォントが読み込まれたら文字幅が変わるので、
 * 読み込み完了で1回作り直す。
 */
export function useCoverPlan(build: (measure: CoverMeasure) => CoverPlan): CoverPlan {
  const [fontRevision, setFontRevision] = useState(0);
  // build は毎回新しい関数なので、作り直しは fontRevision と呼び出し側の再描画に任せる
  const plan = build(canvasCoverMeasure);
  void fontRevision;
  const fontKey = useMemo(
    () =>
      plan.ops
        .flatMap((op) => (op.kind === "glyph" ? [`${op.font.weight}|${op.font.family}|${op.text}`] : []))
        .join(""),
    [plan],
  );
  useEffect(() => {
    let cancelled = false;
    void ensureCoverFonts([plan]).then((loaded) => {
      if (loaded && !cancelled) setFontRevision((value) => value + 1);
    });
    return () => {
      cancelled = true;
    };
    // fontKey が同じなら読み込むものも同じ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontKey]);
  return plan;
}

/** 表紙画像（dataUrl）を描ける形に読み込む。 */
export function useCoverImageSources(dataUrls: Record<string, string>): CoverImageSources {
  const [sources, setSources] = useState<Record<string, { url: string; image: HTMLImageElement }>>({});
  const key = Object.entries(dataUrls)
    .map(([id, url]) => `${id}:${url.length}:${url.slice(-24)}`)
    .join("|");
  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(dataUrls);
    void Promise.all(
      entries.map(async ([id, url]) => {
        try {
          return [id, { url, image: await loadCoverImage(url) }] as const;
        } catch {
          return null;
        }
      }),
    ).then((loaded) => {
      if (cancelled) return;
      setSources(Object.fromEntries(loaded.filter((entry) => entry !== null)));
    });
    return () => {
      cancelled = true;
    };
    // key は dataUrls の中身が変わったときだけ変わる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return useMemo(
    () => Object.fromEntries(Object.entries(sources).map(([id, entry]) => [id, entry.image])),
    [sources],
  );
}

interface CoverCanvasProps {
  plan: CoverPlan;
  images: CoverImageSources;
  /** 画面上の幅（CSS px） */
  cssWidth: number;
  className?: string;
  ariaLabel?: string;
}

export default function CoverCanvas({ plan, images, cssWidth, className, ariaLabel }: CoverCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cssHeight = (cssWidth * plan.heightPx) / Math.max(1, plan.widthPx);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || cssWidth <= 0) return;
    const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.round(cssWidth * ratio));
    const height = Math.max(1, Math.round(cssHeight * ratio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    paintCoverPlan(ctx, plan, width / plan.widthPx, images);
  }, [plan, images, cssWidth, cssHeight]);

  return (
    <canvas
      ref={canvasRef}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={className}
      style={{ width: `${cssWidth}px`, height: `${cssHeight}px`, display: "block" }}
    />
  );
}
