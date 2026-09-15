"use client";

import { useEffect, useRef, useState } from "react";

// TSP-FQ04-PRODUCTION-RUNTIME-DIAGNOSTIC-004: read-only, observability-only
// panel for hunting the Production-only FQ-04 keyboard-viewport failure.
// Only ever mounted by the caller when `?viewportDebug=1` is present (see
// EditorPageContent) -- this file's own code never runs for an ordinary
// URL, so there is no behavior, layout, or performance impact outside that
// explicit opt-in. Never touches localStorage/sessionStorage/network; reads
// only already-public runtime geometry, no manuscript content or user
// identifiers. `position: fixed` so its own presence cannot perturb the
// very layout it's measuring.
//
// TSP-FQ04-VIEWPORT-STATE-DIVERGENCE-008: this panel used to call
// `useMobileKeyboardViewport()`/`useIsNarrowViewport()` independently -- a
// SEPARATE hook instance from TategakiEditor's own. It now receives
// TategakiEditor's real, same-render values as props instead (`parent hook
// ...` below), so there is exactly one `useMobileKeyboardViewport` call
// for the whole Editor page.
//
// TSP-FQ04-DOM-INSTANCE-DIAGNOSTIC-010: a single hook CALL SITE does not
// prove a single runtime TategakiEditor DOM INSTANCE -- this panel used
// `document.querySelector('[data-editor-shell]')` (and the same for the
// textarea), a GLOBAL lookup that would silently measure a different
// mounted/hidden instance if one ever existed. It now measures its OWN
// ancestor shell via `panelRef.current.closest('[data-editor-shell]')`
// (this panel is always rendered inside the shell it should be reading),
// and additionally surfaces the old global-selector result plus raw
// document-wide counts side by side, so a real multi-instance situation
// would be directly visible instead of silently mis-measured.
interface Snapshot {
  innerWidth: number | null;
  innerHeight: number | null;
  vvWidth: number | null;
  vvHeight: number | null;
  vvOffsetTop: number | null;
  vvScale: number | null;
  documentClientHeight: number | null;
  shellCount: number;
  textareaCount: number;
  ownShellInstanceId: string | null;
  ownShellStyleHeight: string | null;
  ownShellComputedHeight: string | null;
  ownShellRectTop: number | null;
  ownShellRectBottom: number | null;
  ownShellRectHeight: number | null;
  globalShellInstanceId: string | null;
  globalShellStyleHeight: string | null;
  globalShellComputedHeight: string | null;
  textareaRectTop: number | null;
  textareaRectBottom: number | null;
  textareaRectHeight: number | null;
  activeElementTag: string | null;
  activeElementType: string | null;
}

const EMPTY_SNAPSHOT: Snapshot = {
  innerWidth: null,
  innerHeight: null,
  vvWidth: null,
  vvHeight: null,
  vvOffsetTop: null,
  vvScale: null,
  documentClientHeight: null,
  shellCount: 0,
  textareaCount: 0,
  ownShellInstanceId: null,
  ownShellStyleHeight: null,
  ownShellComputedHeight: null,
  ownShellRectTop: null,
  ownShellRectBottom: null,
  ownShellRectHeight: null,
  globalShellInstanceId: null,
  globalShellStyleHeight: null,
  globalShellComputedHeight: null,
  textareaRectTop: null,
  textareaRectBottom: null,
  textareaRectHeight: null,
  activeElementTag: null,
  activeElementType: null,
};

function measure(panelEl: HTMLElement | null): Snapshot {
  const vv = window.visualViewport;
  const active = document.activeElement;

  // The panel is always rendered inside the exact shell it should describe
  // -- this is the authoritative measurement.
  const ownShell = panelEl?.closest<HTMLElement>("[data-editor-shell]") ?? null;
  const ownShellRect = ownShell?.getBoundingClientRect();
  const textarea = ownShell?.querySelector<HTMLElement>('[data-demo-target="editor"]') ?? null;
  const textareaRect = textarea?.getBoundingClientRect();

  // Kept only for comparison against the scoped reading above -- this is
  // the OLD, unscoped lookup this diagnostic loop exists to double-check.
  const globalShell = document.querySelector<HTMLElement>("[data-editor-shell]");

  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    vvWidth: vv?.width ?? null,
    vvHeight: vv?.height ?? null,
    vvOffsetTop: vv?.offsetTop ?? null,
    vvScale: vv?.scale ?? null,
    documentClientHeight: document.documentElement.clientHeight,
    shellCount: document.querySelectorAll("[data-editor-shell]").length,
    textareaCount: document.querySelectorAll('[data-demo-target="editor"]').length,
    ownShellInstanceId: ownShell?.getAttribute("data-shell-instance-id") ?? null,
    ownShellStyleHeight: ownShell ? ownShell.style.height || "(unset)" : null,
    ownShellComputedHeight: ownShell ? getComputedStyle(ownShell).height : null,
    ownShellRectTop: ownShellRect?.top ?? null,
    ownShellRectBottom: ownShellRect?.bottom ?? null,
    ownShellRectHeight: ownShellRect?.height ?? null,
    globalShellInstanceId: globalShell?.getAttribute("data-shell-instance-id") ?? null,
    globalShellStyleHeight: globalShell ? globalShell.style.height || "(unset)" : null,
    globalShellComputedHeight: globalShell ? getComputedStyle(globalShell).height : null,
    textareaRectTop: textareaRect?.top ?? null,
    textareaRectBottom: textareaRect?.bottom ?? null,
    textareaRectHeight: textareaRect?.height ?? null,
    activeElementTag: active?.tagName ?? null,
    activeElementType: active instanceof HTMLInputElement ? active.type : null,
  };
}

function fmt(n: number | null, digits = 1): string {
  return n == null ? "—" : n.toFixed(digits);
}

interface ViewportDebugPanelProps {
  /** TategakiEditor's own `useIsNarrowViewport()` value, from the same render. */
  isNarrow: boolean;
  /** TategakiEditor's own `useMobileKeyboardViewport().keyboardActive`, from the same render. */
  keyboardActive: boolean;
  /** TategakiEditor's own `useMobileKeyboardViewport().visibleHeight` -- the exact value passed to `mobileShellHeightStyle` for the shell you see below. */
  visibleHeight: number | null;
  /** The exact `mobileShellHeightStyle(visibleHeight).height` TategakiEditor applied to its shell this render -- same object, not a re-derived copy. */
  expectedShellHeight: string;
  /** TategakiEditor's `useId()`-derived, runtime-only shell identifier -- compare against "own"/"global" measured IDs below to detect a real multi-instance situation. */
  shellInstanceId: string;
}

export default function ViewportDebugPanel({
  isNarrow,
  keyboardActive,
  visibleHeight,
  expectedShellHeight,
  shellInstanceId,
}: ViewportDebugPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const update = () => setSnapshot(measure(panelRef.current));

    update();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("focusin", update);
    window.addEventListener("focusout", update);

    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("focusin", update);
      window.removeEventListener("focusout", update);
    };
  }, []);

  if (dismissed) return null;

  const shellMismatch =
    snapshot.shellCount > 1 || snapshot.ownShellInstanceId !== snapshot.globalShellInstanceId;

  return (
    <div
      ref={panelRef}
      data-viewport-debug-panel=""
      style={{ position: "fixed", top: 0, left: 0, zIndex: 2147483647 }}
      className="max-w-[92vw] overflow-auto border border-lime-400 bg-black/90 p-2 font-mono text-[10px] leading-tight text-lime-300 shadow-lg"
    >
      <div className="mb-1 flex items-center justify-between gap-2 border-b border-lime-400/40 pb-1">
        <span className="font-bold">viewportDebug</span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded border border-lime-400/60 px-1 text-lime-300"
        >
          ✕
        </button>
      </div>
      <div>innerWidth: {fmt(snapshot.innerWidth, 0)}</div>
      <div>innerHeight: {fmt(snapshot.innerHeight, 0)}</div>
      <div>vv.width: {fmt(snapshot.vvWidth)}</div>
      <div>vv.height: {fmt(snapshot.vvHeight)}</div>
      <div>vv.offsetTop: {fmt(snapshot.vvOffsetTop)}</div>
      <div>vv.scale: {fmt(snapshot.vvScale, 2)}</div>
      <div>documentElement.clientHeight: {fmt(snapshot.documentClientHeight, 0)}</div>
      <div className="mt-1 border-t border-lime-400/40 pt-1">parent hook isNarrow: {String(isNarrow)}</div>
      <div>parent hook keyboardActive: {String(keyboardActive)}</div>
      <div>parent hook visibleHeight: {fmt(visibleHeight)}</div>
      <div>expected shell style (same render): {expectedShellHeight}</div>
      <div
        className={`mt-1 border-t pt-1 ${shellMismatch ? "border-red-500 text-red-400" : "border-lime-400/40"}`}
      >
        [data-editor-shell] count in document: {snapshot.shellCount}
        {shellMismatch ? " ⚠ MULTIPLE/MISMATCHED" : ""}
      </div>
      <div>textarea count in document: {snapshot.textareaCount}</div>
      <div>parent shellInstanceId (this render): {shellInstanceId}</div>
      <div>own-shell (closest) instanceId: {snapshot.ownShellInstanceId ?? "—"}</div>
      <div>global-selector instanceId: {snapshot.globalShellInstanceId ?? "—"}</div>
      <div className="mt-1 border-t border-lime-400/40 pt-1">own-shell inline style.height: {snapshot.ownShellStyleHeight ?? "—"}</div>
      <div>own-shell computed height: {snapshot.ownShellComputedHeight ?? "—"}</div>
      <div>own-shell rect top/bottom/height: {fmt(snapshot.ownShellRectTop)} / {fmt(snapshot.ownShellRectBottom)} / {fmt(snapshot.ownShellRectHeight)}</div>
      <div className="mt-1 border-t border-lime-400/40 pt-1">global-selector shell inline style.height: {snapshot.globalShellStyleHeight ?? "—"}</div>
      <div>global-selector shell computed height: {snapshot.globalShellComputedHeight ?? "—"}</div>
      <div className="mt-1 border-t border-lime-400/40 pt-1">own-shell textarea rect top/bottom/height: {fmt(snapshot.textareaRectTop)} / {fmt(snapshot.textareaRectBottom)} / {fmt(snapshot.textareaRectHeight)}</div>
      <div className="mt-1 border-t border-lime-400/40 pt-1">activeElement: {snapshot.activeElementTag ?? "—"}{snapshot.activeElementType ? ` (${snapshot.activeElementType})` : ""}</div>
    </div>
  );
}
