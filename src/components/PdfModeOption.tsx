import { useEffect, useRef } from "react";
import type { PdfExportMode } from "@/utils/exportPdf";

export type PdfModeOptionDefinition = {
  value: PdfExportMode;
  label: string;
  description: string;
  caution?: string;
};

export const PDF_MODE_OPTIONS: readonly PdfModeOptionDefinition[] = [
  {
    value: "trim",
    label: "仕上がりサイズ",
    description: "完成した本と同じページサイズで書き出します。塗り足しやトンボは含みません。",
    caution:
      "注意：主に仕上がり確認用です。塗り足し等が必要な入稿でこの形式を使用すると、サイズ不足のデータになる場合があります。入稿用データには原則使用せず、必ず印刷所の指定をご確認ください。",
  },
  {
    value: "bleed",
    label: "断ち落としサイズ",
    description: "仕上がりサイズの外側3mmまで含めて書き出します。塗り足し3mm込み・トンボなしです。",
  },
  {
    value: "full",
    label: "入稿用フルサイズ",
    description: "仕上がりサイズに塗り足し3mmとトンボを含めて書き出します。",
  },
] as const;

type PdfModeOptionProps = {
  option: PdfModeOptionDefinition;
  checked: boolean;
  helpOpen: boolean;
  onChange: () => void;
  onToggleHelp: () => void;
  onCloseHelp: () => void;
};

/**
 * Help open/close has exactly one trigger: activating the `?` button
 * (mouse click, touch tap, or the browser's native Enter/Space activation
 * of a focused `<button>` -- no bespoke keydown handler needed for that).
 * There is deliberately no onPointerEnter/onFocus path that can also open
 * it and no onBlur path that can also close it -- see pdfModeHelp.ts for
 * why mixing those in caused the Loop 1 correction bugs.
 */
export default function PdfModeOption({
  option,
  checked,
  helpOpen,
  onChange,
  onToggleHelp,
  onCloseHelp,
}: PdfModeOptionProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const helpId = `pdf-mode-${option.value}-help`;

  useEffect(() => {
    if (!helpOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onCloseHelp();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [helpOpen, onCloseHelp]);

  return (
    <div
      data-pdf-mode-option={option.value}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 rounded border border-ink/10 px-3 py-2 text-sm hover:bg-ink/5"
    >
      <label className="flex min-w-0 cursor-pointer items-start gap-2">
        <input
          type="radio"
          name="pdf-export-mode"
          value={option.value}
          checked={checked}
          onChange={onChange}
          className="mt-0.5"
        />
        <span className="text-ink">{option.label}</span>
      </label>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${option.label}の説明`}
        aria-expanded={helpOpen}
        aria-controls={helpId}
        onClick={onToggleHelp}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink/25 text-xs font-semibold text-ink/65 hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden="true">?</span>
      </button>
      {helpOpen && (
        <div
          ref={panelRef}
          id={helpId}
          role="tooltip"
          data-pdf-mode-help={option.value}
          className="col-span-2 mt-2 rounded border border-ink/15 bg-base px-3 py-2 text-xs leading-relaxed text-ink/75 shadow-sm"
        >
          <p>{option.description}</p>
          {option.caution && (
            <p className="mt-2 rounded border border-amber-700/30 bg-amber-100/70 px-2 py-1.5 font-medium text-amber-950">
              {option.caution}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
