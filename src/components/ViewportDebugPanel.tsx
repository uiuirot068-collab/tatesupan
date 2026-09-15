"use client";

import { useEffect, useState } from "react";

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
// SEPARATE hook instance from TategakiEditor's own, with its own
// subscription to `window.visualViewport`. Production evidence showed that
// independent instance reading a correct, fresh `visibleHeight` while the
// shell's actual rendered inline height (driven by TategakiEditor's OWN
// hook instance) stayed on the pre-keyboard value -- i.e. the two instances
// were observed to disagree, and the panel's own copy could never prove
// what TategakiEditor itself actually used to render. It now receives
// TategakiEditor's real, same-render values as props instead (labeled
// `parent hook ...` below) so this can no longer happen by construction:
// there is exactly one `useMobileKeyboardViewport` call for the whole
// Editor page, and this panel only displays it.
interface Snapshot {
  innerWidth: number | null;
  innerHeight: number | null;
  vvWidth: number | null;
  vvHeight: number | null;
  vvOffsetTop: number | null;
  vvScale: number | null;
  documentClientHeight: number | null;
  shellComputedHeight: string | null;
  shellRectTop: number | null;
  shellRectBottom: number | null;
  shellRectHeight: number | null;
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
  shellComputedHeight: null,
  shellRectTop: null,
  shellRectBottom: null,
  shellRectHeight: null,
  textareaRectTop: null,
  textareaRectBottom: null,
  textareaRectHeight: null,
  activeElementTag: null,
  activeElementType: null,
};

function measure(): Snapshot {
  const vv = window.visualViewport;
  const shell = document.querySelector<HTMLElement>("[data-editor-shell]");
  const textarea = document.querySelector<HTMLElement>('[data-demo-target="editor"]');
  const shellRect = shell?.getBoundingClientRect();
  const textareaRect = textarea?.getBoundingClientRect();
  const active = document.activeElement;

  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    vvWidth: vv?.width ?? null,
    vvHeight: vv?.height ?? null,
    vvOffsetTop: vv?.offsetTop ?? null,
    vvScale: vv?.scale ?? null,
    documentClientHeight: document.documentElement.clientHeight,
    shellComputedHeight: shell ? getComputedStyle(shell).height : null,
    shellRectTop: shellRect?.top ?? null,
    shellRectBottom: shellRect?.bottom ?? null,
    shellRectHeight: shellRect?.height ?? null,
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
}

export default function ViewportDebugPanel({ isNarrow, keyboardActive, visibleHeight }: ViewportDebugPanelProps) {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [cssVar, setCssVar] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const update = () => {
      setSnapshot(measure());
      // TSP-FQ04-SHELL-VISIBLE-HEIGHT-FIX-006: the shell no longer sets
      // `--tsp-visible-vh` at all -- it was the confirmed-broken indirection
      // this diagnostic exists to catch (see useMobileKeyboardViewport.ts).
      // This now reads the shell's own raw inline `style.height` (what React
      // actually wrote), which should track `hook visibleHeight` below
      // directly and immediately.
      const shell = document.querySelector<HTMLElement>("[data-editor-shell]");
      setCssVar(shell ? shell.style.height || "(unset)" : null);
    };

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

  return (
    <div
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
      <div>shell inline style.height: {cssVar ?? "—"}</div>
      <div className="mt-1 border-t border-lime-400/40 pt-1">shell computed height: {snapshot.shellComputedHeight ?? "—"}</div>
      <div>shell rect top/bottom/height: {fmt(snapshot.shellRectTop)} / {fmt(snapshot.shellRectBottom)} / {fmt(snapshot.shellRectHeight)}</div>
      <div className="mt-1 border-t border-lime-400/40 pt-1">textarea rect top/bottom/height: {fmt(snapshot.textareaRectTop)} / {fmt(snapshot.textareaRectBottom)} / {fmt(snapshot.textareaRectHeight)}</div>
      <div className="mt-1 border-t border-lime-400/40 pt-1">activeElement: {snapshot.activeElementTag ?? "—"}{snapshot.activeElementType ? ` (${snapshot.activeElementType})` : ""}</div>
    </div>
  );
}
