"use client";

/**
 * TSP-LONG-DOCUMENT-WINDOWED-EDITOR-ARCHITECTURE-007 — diagnostic-only
 * ACTIVE-WINDOW TEXTAREA prototype (`?perfDebug=1&editorProbe=windowed`).
 *
 * Root cause (TSP-LONG-DOCUMENT-WINDOWED-EDITOR-ARCHITECTURE-007, proven via
 * the `uncontrolled-shadow` probe) is the native browser/IME cost of editing
 * ~300k characters inside ONE textarea, independent of React or any app
 * subsystem. This probe tests the fix candidate: keep the textarea
 * CONTROLLED (same reassignment model as production EditorPane, so the
 * result is a realistic estimate of production feel) but bound its `value`
 * to a small ACTIVE WINDOW of the manuscript instead of the whole thing.
 * The full manuscript is held in `canonicalRef` -- a plain ref, deliberately
 * never React state -- so typing inside the window can never trigger a
 * reconciliation pass over the (up to ~300k-char) prefix/suffix text.
 *
 * Diagnostic-only: this component owns its own copy of the manuscript from
 * the moment it mounts. It never calls back into onContentChange, never
 * autosaves, never touches cloud/DB. Edits made here are discarded the
 * moment this probe is switched off or the page reloads.
 *
 * Never logs manuscript text -- only lengths, offsets, and event names (see
 * `@/lib/perfDebug`'s own contract).
 */

import { useEffect, useRef, useState } from "react";
import {
  chooseEditorWindowAroundGlobalOffset,
  globalToLocalOffset,
  isNearWindowEdge,
  localToGlobalOffset,
  replaceWindowRangeInCanonicalText,
  type EditorWindow,
} from "@/lib/windowedEditor/offsetModel";
import { perfMark } from "@/lib/perfDebug";

export const WINDOW_SIZE_PRESETS = [5_000, 10_000, 20_000, 30_000, 50_000] as const;
const DEFAULT_WINDOW_SIZE = 20_000;
// A window is recentred once the caret is within margin of a non-pinned
// edge (Phase 5: "shift only near margins"); default mirrors offsetModel's
// own default (windowSize / 4) so the prototype and its pure functions
// agree without the caller having to restate the constant.
const shiftMargin = (windowSize: number) => Math.floor(windowSize / 4);
// A paste (or automated fix) can grow/shrink the window text far past the
// target size in one commit; recentre immediately rather than letting the
// window drift arbitrarily large. Chosen generously so ordinary
// keystroke-by-keystroke typing never trips it.
const RESHAPE_DRIFT_FACTOR = 1.5;

interface WindowedEditorProbeProps {
  /**
   * The app's own loaded `content`. TategakiEditor mounts EditorPane with
   * `content === ""` and loads the real manuscript asynchronously shortly
   * after (see TategakiEditor's load effect) -- so this prop routinely
   * changes out from under this probe once, early in its lifetime. The
   * probe ADOPTS a new value here (see `adoptExternalContent` below) as
   * long as the user hasn't started editing inside the probe yet; once
   * they have, this prop is never read again -- diagnostic edits are never
   * clobbered by a later external content change, and are never written
   * back either way.
   */
  initialContent: string;
}

export default function WindowedEditorProbe({ initialContent }: WindowedEditorProbeProps) {
  const canonicalLengthAtMount = initialContent.length;
  // The full manuscript. A ref, not state: mutated on every keystroke, but
  // reading it never subscribes a render to it, which is the whole point --
  // see the module doc above.
  const canonicalRef = useRef(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  // Set when a shift was due but deferred because composition was active
  // (Phase 5: "NEVER shift active window during IME composition"); resolved
  // on compositionend.
  const shiftDeferredRef = useRef(false);
  // Set the instant the user makes ANY edit inside the probe -- once true,
  // `initialContent` prop changes are never adopted again (requirement:
  // never overwrite local diagnostic edits after initialization).
  const dirtyRef = useRef(false);
  // The `initialContent` value this probe last initialized itself from.
  // `null` until the first adoption, so the very first non-empty manuscript
  // load (the common case: mount with "" -> async load shortly after) is
  // always adopted exactly once.
  const lastAdoptedContentRef = useRef<string | null>(null);
  // Set when a real content change arrived while the probe's own textarea
  // was mid-IME-composition; resolved (adopted, if still safe) on
  // compositionend. Hard requirement: never reinitialize mid-composition.
  const adoptDeferredRef = useRef(false);

  const [windowSize, setWindowSize] = useState<number>(DEFAULT_WINDOW_SIZE);
  // Phase 3: "Prototype one editable window near the end of the manuscript."
  const [editorWindow, setEditorWindow] = useState<EditorWindow>(() =>
    chooseEditorWindowAroundGlobalOffset(initialContent, initialContent.length, DEFAULT_WINDOW_SIZE)
  );
  const [windowText, setWindowText] = useState<string>(() =>
    initialContent.slice(editorWindow.start, editorWindow.end)
  );

  // Recomputed only when the window's own bounds change (a rare event
  // compared to keystrokes) -- typing inside the window never re-slices
  // these, so this can never reintroduce the full-manuscript-per-keystroke
  // cost this prototype exists to test an alternative to. Derived in an
  // effect (not useMemo) because reading a ref's `.current` during render
  // is unsafe; the one-render lag after a window shift is immaterial for a
  // diagnostic-only prefix/suffix preview.
  // Populated by the effects below, which also run once on mount -- never
  // read from the ref during the initial render.
  const [prefixText, setPrefixText] = useState("");
  const [suffixText, setSuffixText] = useState("");
  useEffect(() => {
    setPrefixText(canonicalRef.current.slice(0, editorWindow.start));
  }, [editorWindow.start]);
  useEffect(() => {
    setSuffixText(canonicalRef.current.slice(editorWindow.end));
  }, [editorWindow.end]);

  // rAF-coalesced HUD-only state (mirrors EditorPane's own paint-probe
  // pattern) -- intentionally NOT updated synchronously on every keystroke,
  // so the diagnostic overlay itself can't be the thing that's slow.
  const [hud, setHud] = useState(() => ({
    localCursor: editorWindow.end - editorWindow.start,
    globalCursor: editorWindow.end,
    canonicalLength: canonicalLengthAtMount,
  }));
  const hudPendingRef = useRef(false);
  const scheduleHudUpdate = (win: EditorWindow) => {
    if (hudPendingRef.current) return;
    hudPendingRef.current = true;
    requestAnimationFrame(() => {
      hudPendingRef.current = false;
      const el = textareaRef.current;
      if (!el) return;
      const localCursor = el.selectionStart;
      setHud({
        localCursor,
        globalCursor: localToGlobalOffset(win.start, localCursor),
        canonicalLength: canonicalRef.current.length,
      });
    });
  };

  useEffect(() => {
    perfMark("WindowedProbe:mount", {
      canonicalLength: canonicalLengthAtMount,
      windowStart: editorWindow.start,
      windowEnd: editorWindow.end,
      windowSize,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only.
  }, []);

  /**
   * (Re)initializes the probe from a freshly-arrived external `content`
   * value: picks a window around the document's end (Phase 3: "one
   * editable window near the end of the manuscript"), populates the
   * textarea, and lands/focuses the caret there. Callers are responsible
   * for the dirty/composition guards -- this function always adopts.
   */
  const adoptExternalContent = (source: string) => {
    const win = chooseEditorWindowAroundGlobalOffset(source, source.length, windowSize, {
      margin: shiftMargin(windowSize),
    });
    const nextWindowText = source.slice(win.start, win.end);
    canonicalRef.current = source;
    lastAdoptedContentRef.current = source;
    perfMark("WindowedProbe:externalContentAdopted", {
      canonicalLength: source.length,
      windowStart: win.start,
      windowEnd: win.end,
      windowTextLength: nextWindowText.length,
    });
    setEditorWindow(win);
    setWindowText(nextWindowText);
    const localCursor = nextWindowText.length;
    setHud({ localCursor, globalCursor: win.end, canonicalLength: source.length });
    // Land the caret at the end of the window (== end of manuscript at
    // adoption time) so the probe starts in the same "typing at the end of
    // a long document" scenario the proven root cause was measured against.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.setSelectionRange(localCursor, localCursor);
      el.focus({ preventScroll: true });
    });
  };

  // Adopts the real manuscript once it arrives asynchronously (the normal
  // path: EditorPane/TategakiEditor mount with `content === ""`, then load
  // the document shortly after -- see TategakiEditor's own load effect).
  // Guarded so a later external change (e.g. a future document switch)
  // never clobbers edits the user has already made inside this diagnostic.
  useEffect(() => {
    if (initialContent === lastAdoptedContentRef.current) return;
    if (dirtyRef.current) {
      perfMark("WindowedProbe:externalContentChange:skippedDirty", { canonicalLength: initialContent.length });
      return;
    }
    if (isComposingRef.current) {
      adoptDeferredRef.current = true;
      perfMark("WindowedProbe:externalContentChange:deferredComposing", { canonicalLength: initialContent.length });
      return;
    }
    adoptExternalContent(initialContent);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- windowSize changes are handled by the preset buttons, not by re-adopting content.
  }, [initialContent]);

  const logEvent = (
    type: string,
    el: HTMLTextAreaElement,
    win: EditorWindow,
    extra?: Record<string, string | number | boolean | null>
  ) => {
    perfMark(`WindowedProbe:native:${type}`, {
      canonicalLength: canonicalRef.current.length,
      windowStart: win.start,
      windowEnd: win.end,
      windowTextLength: el.value.length,
      localCursor: el.selectionStart,
      globalCursor: localToGlobalOffset(win.start, el.selectionStart),
      isComposing: isComposingRef.current,
      ...extra,
    });
  };

  /**
   * Applies a shift decision (Phase 5): recentre the window around the
   * caret's CURRENT global offset, preserving that global offset exactly
   * across the shift, then restores local selection on the (new) textarea
   * next paint. Never called while composing (callers gate on that).
   */
  const shiftWindowTo = (globalCaret: number) => {
    const nextWindow = chooseEditorWindowAroundGlobalOffset(
      canonicalRef.current,
      globalCaret,
      windowSize,
      { margin: shiftMargin(windowSize) }
    );
    const nextWindowText = canonicalRef.current.slice(nextWindow.start, nextWindow.end);
    const nextLocalCaret = globalToLocalOffset(nextWindow.start, globalCaret);
    perfMark("WindowedProbe:windowShift", {
      fromStart: editorWindow.start,
      fromEnd: editorWindow.end,
      toStart: nextWindow.start,
      toEnd: nextWindow.end,
      preservedGlobalCaret: globalCaret,
    });
    setEditorWindow(nextWindow);
    setWindowText(nextWindowText);
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(nextLocalCaret, nextLocalCaret);
    });
  };

  const maybeShiftAfterEdit = (globalCaret: number, liveWindow: EditorWindow, liveWindowTextLength: number) => {
    if (isComposingRef.current) {
      // Hard requirement: never shift mid-composition. Re-evaluated on
      // compositionend instead.
      if (isNearWindowEdge(liveWindow, globalCaret, canonicalRef.current.length, shiftMargin(windowSize))) {
        shiftDeferredRef.current = true;
      }
      return;
    }
    const grewFarPastTarget = liveWindowTextLength > windowSize * RESHAPE_DRIFT_FACTOR;
    const nearEdge = isNearWindowEdge(liveWindow, globalCaret, canonicalRef.current.length, shiftMargin(windowSize));
    if (grewFarPastTarget || nearEdge) {
      shiftWindowTo(globalCaret);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    dirtyRef.current = true;
    const el = event.currentTarget;
    const next = el.value;
    logEvent("input", el, editorWindow, { nextLength: next.length });

    // Live window bounds: the window's END moves with every insertion/
    // deletion inside it (its START only moves on an explicit shift).
    const liveWindow: EditorWindow = { start: editorWindow.start, end: editorWindow.start + next.length };
    canonicalRef.current = replaceWindowRangeInCanonicalText(
      canonicalRef.current,
      editorWindow.start,
      editorWindow.end,
      next
    );
    setEditorWindow(liveWindow);
    setWindowText(next);

    const globalCaret = localToGlobalOffset(liveWindow.start, el.selectionStart);
    scheduleHudUpdate(liveWindow);
    maybeShiftAfterEdit(globalCaret, liveWindow, next.length);
  };

  const handleCompositionStart = (event: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = true;
    logEvent("compositionstart", event.currentTarget, editorWindow);
  };
  const handleCompositionUpdate = (event: React.CompositionEvent<HTMLTextAreaElement>) => {
    logEvent("compositionupdate", event.currentTarget, editorWindow);
  };
  const handleCompositionEnd = (event: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false;
    logEvent("compositionend", event.currentTarget, editorWindow);
    if (shiftDeferredRef.current) {
      shiftDeferredRef.current = false;
      const el = event.currentTarget;
      const globalCaret = localToGlobalOffset(editorWindow.start, el.selectionStart);
      maybeShiftAfterEdit(globalCaret, editorWindow, el.value.length);
    }
    if (adoptDeferredRef.current) {
      adoptDeferredRef.current = false;
      // Re-check dirty: the composition that just ended may itself have
      // been the user's first edit, in which case it must NOT be clobbered.
      if (!dirtyRef.current && initialContent !== lastAdoptedContentRef.current) {
        adoptExternalContent(initialContent);
      }
    }
  };

  const handleBeforeInput = (event: React.FormEvent<HTMLTextAreaElement>) => {
    const nativeEvent = event.nativeEvent as InputEvent;
    logEvent("beforeinput", event.currentTarget, editorWindow, { inputType: nativeEvent.inputType ?? "" });
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Known, intentionally-unsolved limitation (Phase 6A): native Ctrl/Cmd+A
    // can only ever select the text physically inside this textarea, i.e.
    // the active window -- never the full manuscript. Logged, not hidden.
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      perfMark("WindowedProbe:ctrlA:windowOnlySelection", {
        windowStart: editorWindow.start,
        windowEnd: editorWindow.end,
        canonicalLength: canonicalRef.current.length,
      });
    }
    logEvent("keydown", event.currentTarget, editorWindow, { key: event.key });
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex-none space-y-1 bg-amber-200 px-3 py-1.5 text-xs text-amber-900">
        <p className="text-center font-bold">DIAGNOSTIC ONLY — CHANGES ARE NOT SAVED</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span>window size:</span>
          {WINDOW_SIZE_PRESETS.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => {
                setWindowSize(size);
                const globalCaret = localToGlobalOffset(editorWindow.start, textareaRef.current?.selectionStart ?? editorWindow.end - editorWindow.start);
                const nextWindow = chooseEditorWindowAroundGlobalOffset(canonicalRef.current, globalCaret, size, { margin: shiftMargin(size) });
                perfMark("WindowedProbe:windowSizeChange", { size, toStart: nextWindow.start, toEnd: nextWindow.end });
                setEditorWindow(nextWindow);
                setWindowText(canonicalRef.current.slice(nextWindow.start, nextWindow.end));
                const nextLocalCaret = globalToLocalOffset(nextWindow.start, globalCaret);
                requestAnimationFrame(() => textareaRef.current?.setSelectionRange(nextLocalCaret, nextLocalCaret));
              }}
              className={`rounded border px-2 py-0.5 font-mono ${windowSize === size ? "border-amber-900 bg-amber-300 font-bold" : "border-amber-400 bg-amber-100"}`}
            >
              {size.toLocaleString()}
            </button>
          ))}
        </div>
        <p className="text-center font-mono">
          manuscript: {hud.canonicalLength.toLocaleString()} chars — window: [{editorWindow.start.toLocaleString()}, {editorWindow.end.toLocaleString()}) (
          {(editorWindow.end - editorWindow.start).toLocaleString()} chars) — local cursor: {hud.localCursor.toLocaleString()} — global cursor: {hud.globalCursor.toLocaleString()}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {prefixText.length > 0 && (
          <div
            aria-hidden="true"
            data-windowed-probe-prefix=""
            className="max-h-[20%] flex-none overflow-y-auto whitespace-pre-wrap border-b border-dashed border-ink/20 bg-ink/[0.03] p-2 font-mono text-xs text-ink/40"
          >
            {prefixText}
          </div>
        )}

        <textarea
          ref={textareaRef}
          data-demo-target="editor"
          data-editor-probe-mode="windowed"
          value={windowText}
          onKeyDown={handleKeyDown}
          onBeforeInput={handleBeforeInput}
          onChange={handleChange}
          onSelect={() => scheduleHudUpdate(editorWindow)}
          onCompositionStart={handleCompositionStart}
          onCompositionUpdate={handleCompositionUpdate}
          onCompositionEnd={handleCompositionEnd}
          spellCheck={false}
          className="min-h-0 flex-1 resize-none overflow-y-auto overflow-x-hidden bg-transparent p-4 font-mono text-sm leading-relaxed text-ink outline-none"
        />

        {suffixText.length > 0 && (
          <div
            aria-hidden="true"
            data-windowed-probe-suffix=""
            className="max-h-[20%] flex-none overflow-y-auto whitespace-pre-wrap border-t border-dashed border-ink/20 bg-ink/[0.03] p-2 font-mono text-xs text-ink/40"
          >
            {suffixText}
          </div>
        )}
      </div>
    </div>
  );
}
