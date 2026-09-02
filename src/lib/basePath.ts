/**
 * TSP-LOOP-013A — the app's deploy base path.
 *
 * Single source of truth: the `NEXT_PUBLIC_BASE_PATH` build-time env var,
 * which `next.config.ts` also reads to set Next's own `basePath`.
 *   - unset / ""  → app is served from the domain root (local dev, current
 *     tatespun.pages.dev)
 *   - "/tatespun" → app is served under https://spuntales.net/tatespun/
 *
 * `next/link`, the `next/navigation` router, `next/image` and `metadata.icons`
 * already prepend Next's basePath automatically — do NOT use this helper for
 * those. It exists only for the few paths Next does not touch:
 *   - raw `<img src="/…">` (not next/image)
 *   - bare `fetch("/…")` of a file in `public/`
 *   - CSS `url(/…)` values injected from JS
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Prefix a root-absolute path to a `public/` asset with {@link BASE_PATH}.
 * Non-absolute inputs (already-prefixed, data:, http(s):) are returned as-is.
 */
export function withBasePath(path: string): string {
  if (!path.startsWith("/")) return path;
  if (BASE_PATH && path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path}`;
}
