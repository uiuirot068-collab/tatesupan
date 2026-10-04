"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  DEMO_CLOUD_SAVE_GUEST,
  DEMO_CLOUD_SAVE_MEMBER,
  type DemoStep,
} from "@/constants/demoData";
import { useDemoTour } from "@/hooks/useDemoTour";
import { useIsNarrowViewport } from "@/hooks/useIsNarrowViewport";
import { computeDemoCardPlacement, type DemoCardPlacement } from "@/lib/demoPlacement";

interface DemoTourProps {
  /** Signed-in state — decides the cloud-save step copy only. Never triggers auth. */
  isMember: boolean;
  /** Final-step exits — each fully leaves demo mode. */
  onExitToNewProject: () => void;
  onExitToBookshelf: () => void;
  onOpenFeatureGuide: () => void;
  /** ［デモを終了］→［終了する］ — always available, confirmed once. */
  onExit: () => void;
}

function stepBody(step: DemoStep, isMember: boolean, narrow: boolean): string {
  if (step.target === "cloud-save") {
    return isMember ? DEMO_CLOUD_SAVE_MEMBER : DEMO_CLOUD_SAVE_GUEST;
  }
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
  // TSP-DEMO-001: the guide can be folded away (only the guide — the demo
  // keeps running), and ［デモを終了］ asks once before leaving the demo.
  const [collapsed, setCollapsed] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const goNext = () => {
    setConfirmingExit(false);
    next();
  };
  const goPrev = () => {
    setConfirmingExit(false);
    prev();
  };

  // `targetSelector` lets a step spotlight one specific control inside a
  // larger `data-demo-target` surface (see demoData.ts's own doc); it always
  // takes precedence over the ordinary `data-demo-target="${step.target}"`
  // lookup when present.
  const targetQuery = step.targetSelector ?? (step.target ? `[data-demo-target="${step.target}"]` : null);

  const updatePlacement = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    const targets = targetQuery
      ? Array.from(document.querySelectorAll<HTMLElement>(targetQuery))
      : [];
    const target = targets.find((node) => node.offsetParent !== null) ?? null;
    const targetRect = target?.getBoundingClientRect() ?? null;
    const cardRect = card.getBoundingClientRect();
    const viewportHeight = document.documentElement.clientHeight;
    setPlacement(computeDemoCardPlacement(
      targetRect,
      { width: cardRect.width, height: card.scrollHeight },
      { width: document.documentElement.clientWidth, height: viewportHeight },
      // SPN-XFIX-001: on phones every step prefers the bottom of the screen
      // (the toolbar, the title field and the top of the page stay visible);
      // on wide screens the preview step sits beside the preview, over the
      // editor, so the pages it points at are not covered.
      narrow || step.target === "export" ? "lower-safe" : step.target === "preview" ? "beside" : "auto",
      // TSP-DEMO-001: on phones the guide takes at most ~4 tenths of the
      // screen and, with nothing to point at, sits at the bottom — the
      // toolbar and the page in the middle stay readable.
      narrow
        ? { maxCardHeight: Math.round(viewportHeight * 0.36), freeDock: "bottom", largeTargetDock: "bottom" }
        : { largeTargetDock: "bottom" }
    ));
  }, [targetQuery, step.target, narrow]);

  useEffect(() => {
    if (!targetQuery) return;
    let el: HTMLElement | null = null;
    const id = window.setTimeout(() => {
      // Prefer a currently-visible match (the same hook is on the desktop
      // Header control AND the mobile control for some steps).
      const all = Array.from(
        document.querySelectorAll<HTMLElement>(targetQuery)
      );
      el = all.find((n) => n.offsetParent !== null) ?? all[0] ?? null;
      if (!el || el.offsetParent === null) return;
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
  }, [targetQuery, stepNumber, updatePlacement]);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(updatePlacement);
    return () => window.cancelAnimationFrame(frame);
  }, [stepNumber, narrow, collapsed, confirmingExit, updatePlacement]);

  useEffect(() => {
    let frame = 0;
    const schedulePlacement = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updatePlacement);
    };
    // A tap elsewhere (e.g. the phone 本文／プレビュー tabs) can show or hide
    // the step's target without any resize or scroll — re-place after it.
    let tapTimer = 0;
    const scheduleAfterTap = () => {
      window.clearTimeout(tapTimer);
      tapTimer = window.setTimeout(schedulePlacement, 80);
    };
    window.addEventListener("resize", schedulePlacement);
    window.addEventListener("scroll", schedulePlacement, true);
    document.addEventListener("click", scheduleAfterTap, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(tapTimer);
      window.removeEventListener("resize", schedulePlacement);
      window.removeEventListener("scroll", schedulePlacement, true);
      document.removeEventListener("click", scheduleAfterTap, true);
    };
  }, [updatePlacement]);

  const positionStyle: CSSProperties = placement
    ? { top: placement.top, left: placement.left, maxHeight: placement.maxHeight }
    : narrow
      ? { right: 12, bottom: 12 }
      : { right: 24, bottom: 24 };

  if (collapsed) {
    return (
      <button
        type="button"
        data-demo-expand=""
        onClick={() => setCollapsed(false)}
        aria-label={`おためしデモの案内を開く（ステップ ${stepNumber} / ${total}）`}
        className="pointer-events-auto fixed bottom-3 right-3 z-[60] flex items-center gap-2 rounded-full border border-ink/20 bg-base/95 px-3.5 py-2 text-xs font-semibold text-ink/80 shadow-sm backdrop-blur hover:bg-ink/5 md:bottom-6 md:right-6"
      >
        <span className="tabular-nums text-ink/55">STEP {stepNumber} / {total}</span>
        案内を開く
      </button>
    );
  }

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
        <span className="flex items-center gap-0.5">
          <button
            type="button"
            data-demo-collapse=""
            onClick={() => {
              setConfirmingExit(false);
              setCollapsed(true);
            }}
            className="rounded px-2 py-1 text-[11px] font-medium text-ink/70 hover:bg-ink/5"
          >
            案内をたたむ
          </button>
          <button
            type="button"
            onClick={() => setConfirmingExit(true)}
            aria-expanded={confirmingExit}
            className="rounded px-2 py-1 text-[11px] font-medium text-ink/55 hover:bg-ink/5"
            data-demo-exit=""
          >
            デモを終了
          </button>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
        <h2 className="text-sm font-bold text-ink">
          {stepNumber}｜{step.title}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink/75">
          {stepBody(step, isMember, narrow)}
        </p>
        {step.moreInfoHref && step.moreInfoLabel ? (
          <Link
            href={step.moreInfoHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex text-xs font-semibold text-accent hover:underline"
            data-demo-more-info=""
          >
            {step.moreInfoLabel}
          </Link>
        ) : null}
        {step.terms?.length ? (
          <dl
            data-demo-terms=""
            className="mt-2 border-t border-ink/10 pt-1.5 text-[12px] leading-relaxed text-ink/65"
          >
            {step.terms.map((term) => (
              <div key={term.word} className="flex gap-2">
                <dt className="flex-none font-semibold text-ink/80">{term.word}</dt>
                <dd>{term.meaning}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      {confirmingExit ? (
        <div data-demo-exit-confirm="" className="mt-3 flex flex-none flex-col gap-2 border-t border-ink/10 pt-2">
          <p className="text-[12px] leading-relaxed text-ink/75">
            デモを終えて、TateSpunのトップページに戻ります。案内だけを隠したいときは「案内をたたむ」を使ってください。
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              data-demo-exit-cancel=""
              onClick={() => setConfirmingExit(false)}
              className="rounded-full border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5"
            >
              デモを続ける
            </button>
            <button
              type="button"
              data-demo-exit-confirm-button=""
              onClick={onExit}
              className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-base hover:opacity-90"
            >
              終了する
            </button>
          </div>
        </div>
      ) : isLast ? (
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
            onClick={goPrev}
            disabled={isFirst}
            className="rounded-full border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5 disabled:invisible"
          >
            戻る
          </button>
          <button
            type="button"
            data-demo-next=""
            onClick={goNext}
            className="rounded-full bg-ink px-5 py-1.5 text-xs font-semibold text-base hover:opacity-90"
          >
            次へ
          </button>
        </div>
      )}
    </aside>
  );
}
