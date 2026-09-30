export interface TocSettingsItem {
  title: string;
  pageNumber: number;
}

export interface TocSettings {
  /** Whether the generated TOC is part of this work. */
  enabled: boolean;
  /** Last Human-confirmed detection result. Page numbers stay stable until 再検出. */
  items: TocSettingsItem[];
  /** Informational only; null for works that have never created a TOC. */
  updatedAt: number | null;
}

export function createDefaultTocSettings(): TocSettings {
  return { enabled: false, items: [], updatedAt: null };
}

export function normalizeTocSettings(raw: unknown): TocSettings {
  const base = createDefaultTocSettings();
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Partial<TocSettings>;
  const items = Array.isArray(value.items)
    ? value.items
        .filter((item): item is TocSettingsItem =>
          !!item &&
          typeof item === "object" &&
          typeof (item as TocSettingsItem).title === "string" &&
          Number.isFinite((item as TocSettingsItem).pageNumber)
        )
        .map((item) => ({
          title: item.title,
          pageNumber: Math.max(1, Math.trunc(item.pageNumber)),
        }))
    : [];
  return {
    enabled: value.enabled === true && items.length > 0,
    items,
    updatedAt: typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : null,
  };
}

/**
 * Composition-only TOC manuscript. This is NEVER written into the editor's
 * canonical body `content`; Preview/Export may prepend it to the composition
 * source so the TOC occupies real publication pages while editor offsets,
 * search, undo/redo and image markers remain body-only.
 */
export function buildTocCompositionPrefix(toc: TocSettings | undefined): string {
  if (!toc?.enabled || toc.items.length === 0) return "";
  const lines = ["# 目次", "", ...toc.items.map((item) => ` ${item.title} ・・・・・ ${item.pageNumber}`), "", "【改ページ】", ""];
  return lines.join("\n");
}
