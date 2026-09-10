"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  DEMO_STEP_9_GUEST,
  DEMO_STEP_9_MEMBER,
  type DemoStep,
} from "@/constants/demoData";
import { useDemoTour } from "@/hooks/useDemoTour";
import { useIsNarrowViewport } from "@/hooks/useIsNarrowViewport";
import { computeDemoCardPlacement, type DemoCardPlacement } from "@/lib/demoPlacement";

interface DemoTourProps {
  /** Signed-in state — decides STEP 9 copy only. Never triggers auth. */
  isMember: boolean;
  /** STEP 10 exits — each fully leaves demo mode. */
  onExitToNewProject: () => void;
  onExitToBookshelf: () => void;
  onOpenFeatureGuide: () => void;
  /** ［デモを終了］ — always available. */
  onExit: () => void;
}

function stepBody(step: DemoStep, isMember: boolean, narrow: boolean): string {
  if (step.n === 9) return isMember ? DEMO_STEP_9_MEMBER : DEMO_STEP_9_GUEST;
  if (narrow && step.mobileNote) return step.mobileNote;
  return step.body;
}

export default function DemoTour({
  isMember,
  onExitToNewProject,
  onExitToBookshelf,
  onOpenFeatureGuide,
  onExit,
}: DemoTourProps) {
  const { step, stepNumber, total, isFirst, isLast, next, prev } = useDemoTour();
  const narrow = useIsNarrowViewport();
  const cardRef = useRef<HTMLElement>(null);
  const [placement, setPlacement] = useState<DemoCardPlacement | null>(null);

  const updatePlacement = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    const targets = step.target
      ? Array.from(document.querySelectorAll<HTMLElement>(`[data-demo-target="${step.target}"]`))
      : [];
    const target = targets.find((node) => node.offsetParent !== null) ?? null;
    const targetRect = target?.getBoundingClientRect() ?? null;
    const cardRect = card.getBoundingClientRect();
    setPlacement(computeDemoCardPlacement(
      targetRect,
      { width: cardRect.width, height: card.scrollHeight },
      { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }
    ));
  }, [step.target]);

  useEffect(() => {
    if (!step.target) return;
    let el: HTMLElement | null = null;
    const id = window.setTimeout(() => {
      // Prefer a currently-visible match (the same hook is on the desktop
      // Header control AND the mobile control for some steps).
      const all = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-demo-target="${step.target}"]`)
      );
      el = all.find((n) => n.offsetParent !== null) ?? all[0] ?? null;
      if (!el || el.offsetParent === null) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("tsp-demo-spotlight");
      window.requestAnimationFrame(updatePlacement);
    }, 120);
    return () => {
      window.clearTimeout(id);
      el?.classList.remove("tsp-demo-spotlight");
      document
        .querySelectorAll(".tsp-demo-spotlight")
        .forEach((n) => n.classList.remove("tsp-demo-spotlight"));
    };
  }, [step.target, stepNumber, updatePlacement]);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(updatePlacement);
    return () => window.cancelAnimationFrame(frame);
  }, [stepNumber, narrow, updatePlacement]);

  useEffect(() => {
    let frame = 0;
    const schedulePlacement = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updatePlacement);
    };
    window.addEventListener("resize", schedulePlacement);
    window.addEventListener("scroll", schedulePlacement, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedulePlacement);
      window.removeEventListener("scroll", schedulePlacement, true);
    };
  }, [updatePlacement]);

  const positionStyle: CSSProperties = placement
    ? { top: placement.top, left: placement.left, maxHeight: placement.maxHeight }
    : narrow
      ? { right: 12, bottom: 12 }
      : { right: 24, bottom: 24 };

  return (
    <aside
      ref={cardRef}
      data-demo-tour=""
      data-demo-placement={placement?.side ?? "pending"}
      role="region"
      aria-label={`おためしデモ ステップ ${stepNumber} / ${total}`}
      style={positionStyle}
      className="pointer-events-auto fixed z-[60] flex w-[calc(100vw-1.5rem)] max-w-md flex-col rounded-xl border border-ink/15 bg-base/98 p-3 shadow-2xl backdrop-blur md:w-[380px]"
    >
      <div className="mb-1.5 flex flex-none items-center justify-between gap-2">
        <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[11px] font-semibold text-ink/70">
          STEP {stepNumber} / {total}
        </span>
        <button
          type="button"
          data-demo-exit=""
          onClick={onExit}
          className="rounded px-2 py-1 text-[11px] font-medium text-ink/55 hover:bg-ink/5"
        >
          デモを終了
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
        <h2 className="text-sm font-bold text-ink">
          {stepNumber}｜{step.title}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink/75">
          {stepBody(step, isMember, narrow)}
        </p>
      </div>

      {isLast ? (
        <div className="mt-3 flex flex-none flex-col gap-1.5">
          <button
            type="button"
            data-demo-exit-new=""
            onClick={onExitToNewProject}
            className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-base hover:opacity-90"
          >
            ＋ 新しい作品を作る
          </button>
          <div className="flex gap-1.5">
            <button
              type="button"
              data-demo-exit-bookshelf=""
              onClick={onExitToBookshelf}
              className="flex-1 rounded-full border border-ink/25 px-3 py-2 text-xs font-medium text-ink/75 hover:bg-ink/5"
            >
              本棚へ戻る
            </button>
            <button
              type="button"
              data-demo-open-guide=""
              onClick={onOpenFeatureGuide}
              className="flex-1 rounded-full border border-ink/25 px-3 py-2 text-xs font-medium text-ink/75 hover:bg-ink/5"
            >
              もっと詳しく ▶
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-none items-center justify-between gap-2">
          <button
            type="button"
            data-demo-prev=""
            onClick={prev}
            disabled={isFirst}
            className="rounded-full border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5 disabled:invisible"
          >
            戻る
          </button>
          <button
            type="button"
            data-demo-next=""
            onClick={next}
            className="rounded-full bg-ink px-5 py-1.5 text-xs font-semibold text-base hover:opacity-90"
          >
            次へ
          </button>
        </div>
      )}
    </aside>
  );
}
