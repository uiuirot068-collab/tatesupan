/**
 * V2 composition revision contract (Phase 3 export hardening).
 *
 * The V2 layout is computed asynchronously (Editor → debounced Preview prop →
 * PreviewPane debounce → worker). A composition is therefore always tagged with
 * the exact INPUT it was built from, and export only ever uses a composition
 * whose input equals the source state at the moment the user asked to export.
 *
 * `CompositionGate` is the pure part: it remembers the latest completed
 * composition and lets an export wait for the composition of a specific input
 * — resolved by the pipeline's own completion event, never by a sleep or
 * timeout. A waiter is rejected when that input's composition fails or when
 * the caller declares it superseded (the source changed again before it
 * completed), so stale content can never be exported.
 */
import type { PageSettings } from "../pageLayout";

export interface V2CompositionInput {
  content: string;
  settings: PageSettings;
  title: string;
  images: Record<string, string>;
}

function sameImages(a: Record<string, string>, b: Record<string, string>): boolean {
  if (a === b) return true;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}

function sameSettings(a: PageSettings, b: PageSettings): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** True when both inputs describe the same manuscript + settings + title + images. */
export function compositionInputsEqual(a: V2CompositionInput, b: V2CompositionInput): boolean {
  return a.content === b.content && a.title === b.title && sameSettings(a.settings, b.settings) && sameImages(a.images, b.images);
}

export class StaleCompositionError extends Error {
  constructor(message = "原稿が書き出し中に変更されたため、書き出しを中止しました。もう一度お試しください。") {
    super(message);
    this.name = "StaleCompositionError";
  }
}

interface Waiter<T> {
  input: V2CompositionInput;
  resolve: (result: T) => void;
  reject: (error: Error) => void;
}

export class CompositionGate<T> {
  private latest: { input: V2CompositionInput; result: T } | null = null;
  private waiters: Waiter<T>[] = [];

  /** The latest completed composition, only if it was built from `input`. */
  currentFor(input: V2CompositionInput): T | null {
    return this.latest && compositionInputsEqual(this.latest.input, input) ? this.latest.result : null;
  }

  complete(input: V2CompositionInput, result: T): void {
    this.latest = { input, result };
    this.settle((waiter) => compositionInputsEqual(waiter.input, input), (waiter) => waiter.resolve(result));
  }

  fail(input: V2CompositionInput, error: Error): void {
    this.settle((waiter) => compositionInputsEqual(waiter.input, input), (waiter) => waiter.reject(error));
  }

  /** Resolves with the composition of exactly `input` (immediately when already current). */
  waitFor(input: V2CompositionInput): Promise<T> {
    const current = this.currentFor(input);
    if (current !== null) return Promise.resolve(current);
    return new Promise<T>((resolve, reject) => this.waiters.push({ input, resolve, reject }));
  }

  /** Rejects every waiter whose input is not `current` — the source moved on. */
  supersede(current: V2CompositionInput, error: Error = new StaleCompositionError()): void {
    this.settle((waiter) => !compositionInputsEqual(waiter.input, current), (waiter) => waiter.reject(error));
  }

  get pendingCount(): number {
    return this.waiters.length;
  }

  private settle(match: (waiter: Waiter<T>) => boolean, action: (waiter: Waiter<T>) => void): void {
    const matched = this.waiters.filter(match);
    this.waiters = this.waiters.filter((waiter) => !match(waiter));
    matched.forEach(action);
  }
}
