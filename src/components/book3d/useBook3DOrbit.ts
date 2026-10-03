"use client";

/**
 * Shared 3D book controller (Cover 3D + Editor 3D).
 * - drag: mouse rotates both axes; touch rotates horizontally only, so the
 *   stage (touch-action: pan-y) never blocks vertical page scrolling
 * - stage size via ResizeObserver (no wheel capture anywhere)
 */
import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { clampPitch, normalizeYaw, type Book3DView } from "@/lib/book3d/book3dView";

type DragState = { pointerId: number; x: number; y: number; start: Book3DView } | null;

export function useBook3DOrbit(
  view: Book3DView,
  onViewChange: (view: Book3DView) => void,
) {
  const drag = useRef<DragState>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // interactive overlays inside the stage (e.g. the ノド注意 guide) keep their clicks
    if ((event.target as HTMLElement).closest("button,input,select,label,[data-gutter-guide]")) return;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: view };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.x;
    const dy = event.pointerType === "touch" ? 0 : event.clientY - state.y;
    onViewChange({
      yaw: normalizeYaw(state.start.yaw + dx * 0.45),
      pitch: clampPitch(state.start.pitch - dy * 0.3),
    });
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
  };

  const rotate = (dyaw: number, dpitch: number) =>
    onViewChange({ yaw: normalizeYaw(view.yaw + dyaw), pitch: clampPitch(view.pitch + dpitch) });

  return {
    dragging,
    rotate,
    stageHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  };
}

export function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    // ResizeObserver reports the initial size right after observe().
    const observer = new ResizeObserver(() =>
      setSize({ width: element.clientWidth, height: element.clientHeight }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
