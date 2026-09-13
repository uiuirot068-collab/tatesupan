"use client";

/**
 * TSP-EDITOR-NATIVE-SURFACE-AB-006 — diagnostic-only editor surface probe
 * (`?perfDebug=1&editorProbe=uncontrolled-shadow`). An UNCONTROLLED
 * textarea seeded once via `defaultValue` from the real manuscript, with no
 * controlled `value` reassignment on keystroke, no Preview sync, no
 * autosave, no cloud save, no writing-check, no cursor-follow, and no path
 * back to the real document state -- isolates whether React's controlled
 * full-document `value` reassignment (EditorPane's normal textarea) is the
 * dominant typing-latency cost at real-manuscript scale, independent of
 * every other subsystem. Typed changes here are diagnostic-only and are
 * discarded when this mode is switched off; never logs manuscript text.
 */

import { useRef } from "react";
import { perfMark } from "@/lib/perfDebug";

interface DiagnosticShadowEditorProps {
  /** Snapshot of the real content at the moment this probe mounted -- never re-synced. */
  initialContent: string;
}

export default function DiagnosticShadowEditor({ initialContent }: DiagnosticShadowEditorProps) {
  const isComposingRef = useRef(false);

  const logNative = (type: string, el: HTMLTextAreaElement) => {
    perfMark(`ShadowProbe:native:${type}`, {
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
      isComposing: isComposingRef.current,
      contentLength: el.value.length,
    });
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex-none bg-amber-200 px-3 py-1 text-center text-xs font-bold text-amber-900">
        DIAGNOSTIC ONLY — CHANGES ARE NOT SAVED
      </div>
      <textarea
        data-demo-target="editor"
        data-shadow-probe="uncontrolled-shadow"
        defaultValue={initialContent}
        onKeyDown={(event) => logNative("keydown", event.currentTarget)}
        onBeforeInput={(event) => {
          const nativeEvent = event.nativeEvent as InputEvent;
          perfMark("ShadowProbe:native:beforeinput", {
            inputType: nativeEvent.inputType ?? "",
            selectionStart: event.currentTarget.selectionStart,
            selectionEnd: event.currentTarget.selectionEnd,
            isComposing: isComposingRef.current,
            contentLength: event.currentTarget.value.length,
          });
        }}
        onChange={(event) => logNative("input", event.currentTarget)}
        onCompositionStart={(event) => {
          isComposingRef.current = true;
          logNative("compositionstart", event.currentTarget);
        }}
        onCompositionUpdate={(event) => logNative("compositionupdate", event.currentTarget)}
        onCompositionEnd={(event) => {
          isComposingRef.current = false;
          logNative("compositionend", event.currentTarget);
        }}
        onSelect={(event) => logNative("select", event.currentTarget)}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none overflow-y-auto overflow-x-hidden bg-transparent p-4 font-mono text-sm leading-relaxed text-ink outline-none"
      />
    </div>
  );
}
