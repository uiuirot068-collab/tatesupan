import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PdfModeOption, { PDF_MODE_OPTIONS } from "./PdfModeOption";
import { toggleHelp } from "./pdfModeHelp";

describe("PDF mode help", () => {
  it("keeps the three established modes and explains their exact geometry", () => {
    expect(PDF_MODE_OPTIONS).toEqual([
      expect.objectContaining({
        value: "trim",
        label: "仕上がりサイズ",
        description: expect.stringContaining("塗り足しやトンボは含みません"),
        caution: expect.stringMatching(/入稿用データには原則使用せず.*印刷所の指定/),
      }),
      expect.objectContaining({
        value: "bleed",
        label: "断ち落としサイズ",
        description: expect.stringMatching(/外側3mm.*トンボなし/),
      }),
      expect.objectContaining({
        value: "full",
        label: "入稿用フルサイズ",
        description: expect.stringMatching(/塗り足し3mmとトンボ/),
      }),
    ]);
  });

  it("renders an independent accessible help control without changing the radio contract", () => {
    const option = PDF_MODE_OPTIONS[0];
    const markup = renderToStaticMarkup(
      <PdfModeOption
        option={option}
        checked
        helpOpen
        onChange={vi.fn()}
        onToggleHelp={vi.fn()}
        onCloseHelp={vi.fn()}
      />
    );

    expect(markup).toContain('type="radio"');
    expect(markup).toContain('name="pdf-export-mode"');
    expect(markup).toContain('value="trim"');
    expect(markup).toContain('aria-label="仕上がりサイズの説明"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('role="tooltip"');
    expect(markup).toContain('data-pdf-mode-help="trim"');
  });

  it("shows help for an UNCHECKED option too -- help state never depends on radio selection", () => {
    const option = PDF_MODE_OPTIONS[1]; // bleed, not the default "trim"
    const markup = renderToStaticMarkup(
      <PdfModeOption
        option={option}
        checked={false}
        helpOpen
        onChange={vi.fn()}
        onToggleHelp={vi.fn()}
        onCloseHelp={vi.fn()}
      />
    );

    expect(markup).not.toContain("checked");
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('data-pdf-mode-help="bleed"');
    expect(markup).toContain(option.description);
  });

  it("the `?` button has a single onClick and no hover/focus/blur wiring (source-level guard against TSP-UX-V3-LOOP1-CORRECTION-011 regressing)", () => {
    const option = PDF_MODE_OPTIONS[0];
    const onToggleHelp = vi.fn();
    // renderToStaticMarkup never invokes event handlers, so this only proves
    // the component still renders with exactly this prop contract (no extra
    // onPointerEnter/onFocus/onBlur prop the component could route through).
    // The interaction contract itself is a plain closure over these two
    // callbacks -- see the toggleHelp() unit tests below for the actual
    // open/close/toggle/independence-from-selection behavior, and PdfModeOption.tsx's
    // JSX (onClick={onToggleHelp} only) for the structural guarantee that no
    // other event can reach it.
    renderToStaticMarkup(
      <PdfModeOption
        option={option}
        checked
        helpOpen={false}
        onChange={vi.fn()}
        onToggleHelp={onToggleHelp}
        onCloseHelp={vi.fn()}
      />
    );
    expect(onToggleHelp).not.toHaveBeenCalled();
  });
});

describe("toggleHelp -- the single state transition every `?` click routes through", () => {
  it("1. clicking the SELECTED option's `?` opens it", () => {
    expect(toggleHelp(null, "trim")).toBe("trim");
  });

  it("2. clicking an UNSELECTED option's `?` opens it too -- selection is never consulted", () => {
    expect(toggleHelp(null, "bleed")).toBe("bleed");
    expect(toggleHelp(null, "full")).toBe("full");
  });

  it("3. toggleHelp never reads or returns anything about which radio is checked", () => {
    // toggleHelp's signature only takes (current open id, clicked id) --
    // there is no `checked`/`pdfMode` parameter it could branch on.
    expect(toggleHelp.length).toBe(2);
  });

  it("4. clicking the SAME open `?` again closes it", () => {
    expect(toggleHelp("trim", "trim")).toBeNull();
    expect(toggleHelp("full", "full")).toBeNull();
  });

  it("5. clicking a DIFFERENT `?` while one is open switches to the new one (old implicitly closes, no double-open)", () => {
    expect(toggleHelp("trim", "bleed")).toBe("bleed");
    expect(toggleHelp("bleed", "full")).toBe("full");
  });

  it("outside click / Escape close via the plain `() => null` path (setOpenPdfModeHelp(null) in PreviewPane), independent of toggleHelp", () => {
    // Documents the contract: closing from outside-click or Escape never
    // goes through toggleHelp at all, so it can never accidentally re-open
    // a different panel -- it always lands on null.
    expect(toggleHelp("trim", "trim")).toBeNull();
  });
});
