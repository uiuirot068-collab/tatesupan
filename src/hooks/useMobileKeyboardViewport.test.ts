/**
 * TSP-FRIEND-QA-MOBILE-VISUAL-VIEWPORT-001: covers `subscribeToKeyboardViewport`,
 * the pure, DOM-injectable core behind `useMobileKeyboardViewport` -- against
 * a stub window-like object (no jsdom), the same pattern
 * `createJsonLocalStorageHook.test.ts` uses for its store. The thin React
 * hook wrapper (the `useIsNarrowViewport` mobile gate + useEffect/useState)
 * is not separately exercised here: this repo's own vitest configs run
 * component/hook suites under `environment: "node"` (no DOM), so hooks are
 * never rendered in tests -- see `src/hooks/vitest.config.ts` and
 * `src/components/vitest.config.ts`. The mobile-only gate itself is a
 * three-line early return (see the hook's own source) verified by
 * inspection and by Human QA on desktop widths.
 */
import { describe, expect, it } from "vitest";
import { INACTIVE_KEYBOARD_VIEWPORT, subscribeToKeyboardViewport } from "./useMobileKeyboardViewport";

class FakeVisualViewport {
  height: number;
  private listeners: Array<() => void> = [];

  constructor(height: number) {
    this.height = height;
  }

  addEventListener(type: "resize", listener: () => void): void {
    if (type !== "resize") return;
    this.listeners.push(listener);
  }

  removeEventListener(type: "resize", listener: () => void): void {
    if (type !== "resize") return;
    const i = this.listeners.indexOf(listener);
    if (i >= 0) this.listeners.splice(i, 1);
  }

  /** Simulates the keyboard opening/closing or an orientation change. */
  resizeTo(height: number): void {
    this.height = height;
    for (const listener of this.listeners) listener();
  }

  get listenerCount(): number {
    return this.listeners.length;
  }
}

function makeWindow(innerHeight: number, visualViewport: FakeVisualViewport | null) {
  return { innerHeight, visualViewport };
}

describe("subscribeToKeyboardViewport", () => {
  it("falls back to inactive when visualViewport is unavailable", () => {
    const win = makeWindow(800, null);
    const notified: unknown[] = [];
    const unsubscribe = subscribeToKeyboardViewport(win, (state) => notified.push(state));

    expect(notified).toEqual([INACTIVE_KEYBOARD_VIEWPORT]);
    expect(() => unsubscribe()).not.toThrow();
  });

  it("reports the initial visible height with the keyboard closed", () => {
    const vv = new FakeVisualViewport(800);
    const win = makeWindow(800, vv);
    const notified: unknown[] = [];
    subscribeToKeyboardViewport(win, (state) => notified.push(state));

    expect(notified).toEqual([{ visibleHeight: 800, keyboardActive: false }]);
  });

  it("detects a keyboard-sized viewport shrink", () => {
    const vv = new FakeVisualViewport(800);
    const win = makeWindow(800, vv);
    const notified: unknown[] = [];
    subscribeToKeyboardViewport(win, (state) => notified.push(state));

    vv.resizeTo(400); // keyboard opens, well past the 150px detection threshold

    expect(notified.at(-1)).toEqual({ visibleHeight: 400, keyboardActive: true });
  });

  it("does not flag an ordinary browser-chrome change as the keyboard", () => {
    const vv = new FakeVisualViewport(800);
    const win = makeWindow(800, vv);
    const notified: unknown[] = [];
    subscribeToKeyboardViewport(win, (state) => notified.push(state));

    vv.resizeTo(730); // e.g. Safari's URL bar collapsing -- under the threshold

    expect(notified.at(-1)).toEqual({ visibleHeight: 730, keyboardActive: false });
  });

  it("restores to inactive when the keyboard closes", () => {
    const vv = new FakeVisualViewport(800);
    const win = makeWindow(800, vv);
    const notified: unknown[] = [];
    subscribeToKeyboardViewport(win, (state) => notified.push(state));

    vv.resizeTo(400);
    vv.resizeTo(800);

    expect(notified.at(-1)).toEqual({ visibleHeight: 800, keyboardActive: false });
  });

  it("recovers correctly across a resize sequence resembling an orientation change", () => {
    const vv = new FakeVisualViewport(800);
    const win = makeWindow(800, vv);
    const notified: unknown[] = [];
    subscribeToKeyboardViewport(win, (state) => notified.push(state));

    // Portrait -> landscape (innerHeight itself doesn't change here since
    // the stub doesn't model it, but the same `resize` event path fires).
    vv.resizeTo(360);
    vv.resizeTo(800);

    expect(notified.map((s) => (s as { keyboardActive: boolean }).keyboardActive)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("cleans up its resize listener on unsubscribe", () => {
    const vv = new FakeVisualViewport(800);
    const win = makeWindow(800, vv);
    const notified: unknown[] = [];
    const unsubscribe = subscribeToKeyboardViewport(win, (state) => notified.push(state));

    expect(vv.listenerCount).toBe(1);
    unsubscribe();
    expect(vv.listenerCount).toBe(0);

    vv.resizeTo(300); // no listener left -- must not notify again
    expect(notified).toHaveLength(1);
  });
});
