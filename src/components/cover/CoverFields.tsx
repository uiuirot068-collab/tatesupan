"use client";

/**
 * CST-PORT-011: 表紙の画面で使う小さな入力部品。
 * 色の16進数や数字は、打ちかけ（"#12" や "4."）で値が戻らないよう、
 * 正しい値になったときだけ反映する。
 */
import { useState, type ReactNode } from "react";
import { isHexColor } from "@/lib/cover/coverModel";

export const coverInputClass =
  "w-full min-w-0 rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none";

export function CoverSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="border-t border-ink/15 pt-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {note ? <span className="text-[11px] text-ink/50">{note}</span> : null}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  small = false,
}: {
  value: T;
  options: ReadonlyArray<{ id: T; name: string }>;
  onChange: (next: T) => void;
  label: string;
  small?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={`rounded border px-3 ${small ? "py-1 text-xs" : "py-1.5 text-sm"} transition-colors ${
            value === option.id
              ? "border-accent bg-accent/10 font-semibold text-ink"
              : "border-ink/20 text-ink/65 hover:bg-ink/5"
          }`}
        >
          {option.name}
        </button>
      ))}
    </div>
  );
}

export function HexColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useState<{ base: string; text: string } | null>(null);
  const text = draft && draft.base === value ? draft.text : value;
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 text-xs text-ink/65">
        <span className="min-w-[4.5em] shrink-0 whitespace-nowrap">{label}</span>
        <input
          type="color"
          value={value}
          onChange={(event) => {
            setDraft(null);
            onChange(event.target.value);
          }}
          className="h-8 w-10 cursor-pointer rounded border border-ink/20 bg-base p-0.5"
        />
      </label>
      <input
        aria-label={`${label}（16進数）`}
        value={text}
        maxLength={7}
        spellCheck={false}
        onChange={(event) => {
          const next = event.target.value.trim();
          const normalized = next.startsWith("#") ? next : `#${next}`;
          if (isHexColor(normalized)) {
            setDraft(null);
            onChange(normalized.toLowerCase());
          } else {
            setDraft({ base: value, text: event.target.value });
          }
        }}
        onBlur={() => setDraft(null)}
        className={`${coverInputClass} w-24 font-mono text-xs`}
      />
    </div>
  );
}

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (next: number) => void;
}) {
  return (
    <label className="grid grid-cols-[6.5em_minmax(0,1fr)_3.5em] items-center gap-2 text-xs text-ink/65">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[var(--color-accent,#8a6d3b)]"
      />
      <strong className="text-right font-semibold text-ink">
        {value}
        {unit}
      </strong>
    </label>
  );
}

export function NumberField({
  label,
  value,
  min,
  max,
  unit,
  onCommit,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onCommit: (next: number) => void;
  disabled?: boolean;
}) {
  // 打っている間は打った文字のまま表示し、範囲内の数字になったときだけ反映する
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="flex items-center gap-2 text-xs text-ink/65">
      <span className="min-w-[4.5em] shrink-0 whitespace-nowrap">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={draft ?? String(value)}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value.replace(/[０-９．]/g, (ch) =>
            ch === "．" ? "." : String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
          );
          setDraft(raw);
          const parsed = Number(raw);
          if (raw.trim() !== "" && Number.isFinite(parsed) && parsed >= min && parsed <= max) {
            onCommit(parsed);
          }
        }}
        onBlur={() => setDraft(null)}
        className={`${coverInputClass.replace("w-full ", "")} w-24 text-right`}
      />
      <span>{unit}</span>
    </label>
  );
}
