import type { PageSettings } from "@/lib/pageLayout";

export interface RunningHeadApplyResult {
  settings: PageSettings;
  oddPages: number[];
  evenPages: number[];
  scope: "all" | "selected";
}

/**
 * Applies the current odd/even running-head values to the active page scope.
 * An empty selection means the whole document: existing per-page head text is
 * removed so every page resolves from the canonical odd/even master values.
 * A selection is 1-based and is always normalized into physical page order.
 */
export function applyRunningHeads(
  settings: PageSettings,
  selectedPageNumbers: readonly number[]
): RunningHeadApplyResult {
  const selected = Array.from(
    new Set(selectedPageNumbers.filter((page) => Number.isInteger(page) && page > 0))
  ).sort((a, b) => a - b);

  if (selected.length === 0) {
    const pageOverrides = Object.fromEntries(
      Object.entries(settings.pageOverrides).flatMap(([page, override]) => {
        const rest = { ...override };
        delete rest.hashiraOverride;
        return Object.keys(rest).length > 0 ? [[Number(page), rest]] : [];
      })
    );
    return {
      settings: { ...settings, pageOverrides },
      oddPages: [],
      evenPages: [],
      scope: "all",
    };
  }

  const oddPages = selected.filter((page) => page % 2 === 1);
  const evenPages = selected.filter((page) => page % 2 === 0);
  const nextOverrides = { ...settings.pageOverrides };
  for (const page of selected) {
    nextOverrides[page] = {
      ...(settings.pageOverrides[page] ?? {}),
      hashiraOverride:
        page % 2 === 1 ? settings.masterPage.hashiraOdd : settings.masterPage.hashiraEven,
    };
  }

  return {
    settings: { ...settings, pageOverrides: nextOverrides },
    oddPages,
    evenPages,
    scope: "selected",
  };
}
