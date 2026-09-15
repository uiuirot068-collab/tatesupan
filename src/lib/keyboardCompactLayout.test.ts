/**
 * TSP-FQ04-KEYBOARD-COMPACT-LAYOUT-014: Production diagnostics confirmed
 * viewport propagation itself is correct (see useMobileKeyboardViewport.ts
 * and roadmap §26) -- the actual remaining problem was normal-mode chrome
 * above the manuscript textarea claiming the same fixed space it does with
 * the keyboard closed, leaving the textarea an impractically thin sliver
 * once the visible shell shrinks.
 *
 * The fix is a presentation-only, CSS-only, mobile-only rule keyed off the
 * existing `[data-keyboard-active]` attribute (already written by
 * TategakiEditor from the existing `useMobileKeyboardViewport` heuristic --
 * no new state). It intentionally never touches EditorPane.tsx's own
 * className logic, several lines of which are pinned by exact-string
 * assertions in postBlockerUx.test.ts / rcPolishRound5.test.ts /
 * rcPolishRound6.test.ts / reportRestoration.test.ts (a prior FQ-04 attempt
 * to compact the secondary nav row via className changes broke 11 of those
 * tests) -- so this suite asserts the CSS-only contract directly, against
 * globals.css, TategakiEditor.tsx, and EditorPane.tsx source text, matching
 * this repo's existing convention (see demoPlacement.test.ts's own
 * cross-file assertions) rather than rendering any component.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");
const editor = readFileSync(join(__dirname, "..", "components", "TategakiEditor.tsx"), "utf8");
const pane = readFileSync(join(__dirname, "..", "components", "EditorPane.tsx"), "utf8");

describe("keyboard-active compact layout (CSS-only, mobile-only)", () => {
  it("scopes every compaction rule to the mobile-only media query, never affecting desktop", () => {
    const mediaBlockStart = css.indexOf("@media (max-width: 767px)");
    const compactRuleIndex = css.indexOf("[data-editor-shell][data-keyboard-active] [data-editor-header-slot]");
    expect(mediaBlockStart).toBeGreaterThanOrEqual(0);
    expect(compactRuleIndex).toBeGreaterThan(mediaBlockStart);
    // The rule must close before the media block itself closes -- find the
    // matching closing brace of the @media block and confirm the compact
    // rule sits inside it, not after.
    const afterMedia = css.slice(mediaBlockStart);
    const mediaBlockEnd = mediaBlockStart + afterMedia.indexOf("\n}\n");
    expect(compactRuleIndex).toBeLessThan(mediaBlockEnd);
  });

  it("only compacts the three approved secondary chrome blocks, gated on [data-keyboard-active]", () => {
    const ruleStart = css.indexOf("[data-editor-shell][data-keyboard-active] [data-editor-header-slot]");
    const ruleBlock = css.slice(ruleStart, css.indexOf("}", ruleStart) + 1);

    expect(ruleBlock).toContain("[data-editor-shell][data-keyboard-active] [data-editor-header-slot]");
    expect(ruleBlock).toContain("[data-editor-shell][data-keyboard-active] [data-editor-secondary-row]");
    expect(ruleBlock).toContain('[data-editor-shell][data-keyboard-active] [data-demo-target="title"]');
    expect(ruleBlock).toContain("display: none");

    // Nothing else gets pulled into this same rule -- primary controls,
    // MobileEditorNav, and the textarea itself are never targeted.
    expect(ruleBlock).not.toContain("data-editor-action-row");
    expect(ruleBlock).not.toContain("data-demo-target=\"editor\"");
    expect(ruleBlock).not.toContain("MobileEditorNav");
  });

  it("does not modify EditorPane's or TategakiEditor's existing className logic (pinned by other suites)", () => {
    // These exact strings are asserted verbatim elsewhere (postBlockerUx,
    // rcPolishRound5/6, reportRestoration, demoPlacement) -- confirming
    // they're untouched here is a direct regression guard for this change.
    expect(editor).toContain('data-editor-header-slot=""');
    expect(editor).toContain('className={focusMode ? "hidden" : "flex-none"}');
    expect(pane).toContain('data-editor-secondary-row=""');
    expect(pane).toContain('<div className={focusMode ? "hidden" : ""}>');
    expect(pane).toContain('data-demo-target="title"');
  });

  it("keeps the primary action row, MobileEditorNav, and keyboard-active footer compaction unrelated to this new rule", () => {
    // The action row (undo/redo/page-break/replace/report) has no
    // `keyboardActive` gating anywhere -- it must stay visible regardless.
    expect(pane).not.toMatch(/data-editor-action-row=""[\s\S]{0,400}keyboardActive/);
    // MobileEditorNav is rendered directly by TategakiEditor with no
    // keyboardActive-conditional wrapper -- it must stay mounted and
    // visible while the keyboard is open (kept per this loop's own policy:
    // minimal nav/escape path + save/status indicator).
    const navIndex = editor.indexOf("<MobileEditorNav");
    expect(navIndex).toBeGreaterThan(0);
    const beforeNav = editor.slice(Math.max(0, navIndex - 200), navIndex);
    expect(beforeNav).not.toContain("keyboardActive &&");
    expect(beforeNav).not.toContain("keyboardActive ?");
  });

  it("keeps the existing footer keyboard-active compaction (EditorPane) intact and separate from this CSS rule", () => {
    expect(pane).toContain('footerCollapsed && !focusMode && !keyboardActive');
    expect(pane).toContain('footerCollapsed || keyboardActive ? "max-md:hidden" : ""');
  });

  it("writes data-keyboard-active as a genuinely absent attribute when inactive, not a \"false\" value -- so the plain [data-keyboard-active] presence selector can never match the inactive state", () => {
    // React omits an attribute entirely when its JSX value is `undefined`
    // (never rendering `data-keyboard-active="false"` or `="undefined"`),
    // so a bare `[data-keyboard-active]` CSS presence-selector is already
    // exactly correct here -- there is no falsy attribute VALUE it could
    // ever accidentally match. A value-based selector like
    // `[data-keyboard-active="true"]` would be wrong instead: the active
    // value is `""` (empty string), not the string "true".
    expect(editor).toContain('data-keyboard-active={keyboardActive ? "" : undefined}');
    expect(editor).not.toMatch(/data-keyboard-active=\{keyboardActive \? "true" : "false"\}/);
    expect(css).not.toContain('[data-keyboard-active="true"]');
    expect(css).not.toContain('[data-keyboard-active="false"]');
  });
});

/**
 * TSP-FQ04-DIAGNOSTIC-CLEANUP-016: once FQ-04's compact-layout fix received
 * a Production real-device Human PASS, the temporary `?viewportDebug=1`
 * instrumentation (ViewportDebugPanel, its MutationObserver, the
 * shell-instance-id/expectedShellHeight diagnostic props) is no longer
 * needed and was removed entirely. This guards against it quietly coming
 * back: `/editor?viewportDebug=1` must now behave exactly like ordinary
 * `/editor` -- no query-param branch left to react to it, no panel left to
 * mount. The actual FQ-04 production behavior it was built to diagnose
 * (`useMobileKeyboardViewport`, `mobileShellHeightStyle`, `data-keyboard-active`,
 * the compact-layout CSS above) is asserted as unchanged throughout this
 * same file's other tests.
 */
describe("viewportDebug diagnostic instrumentation fully removed", () => {
  const page = readFileSync(join(__dirname, "..", "app", "editor", "page.tsx"), "utf8");

  it("no longer parses or forwards the viewportDebug query param anywhere", () => {
    expect(page).not.toContain("viewportDebug");
    expect(editor).not.toContain("viewportDebug");
  });

  it("no longer imports or mounts ViewportDebugPanel", () => {
    expect(editor).not.toContain("ViewportDebugPanel");
  });

  it("the ViewportDebugPanel component file itself no longer exists", () => {
    expect(existsSync(join(__dirname, "..", "components", "ViewportDebugPanel.tsx"))).toBe(false);
  });

  it("no diagnostic-only shell instance id or expected-height props remain", () => {
    expect(editor).not.toContain("shellInstanceId");
    expect(editor).not.toContain("data-shell-instance-id");
    expect(editor).not.toContain("expectedShellHeight");
    expect(editor).not.toContain("useId");
    // useIsNarrowViewport was only ever read in TategakiEditor to hand down
    // to the now-removed diagnostic panel -- confirm that dead import/call
    // is gone too, not just the panel that consumed it.
    expect(editor).not.toContain("useIsNarrowViewport");
  });

  it("preserves the actual Human-passed FQ-04 production behavior the diagnostics were built to verify", () => {
    expect(editor).toContain("useMobileKeyboardViewport()");
    expect(editor).toContain("mobileShellHeightStyle(visibleHeight)");
    expect(editor).toContain('data-keyboard-active={keyboardActive ? "" : undefined}');
  });
});
