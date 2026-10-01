import { describe, expect, it } from "vitest";
import { resolvePreviewNombre } from "./previewNombre";

const base = { nombrePosition: "center", hideNombre: false, hideNombreOnFirstPage: false, nombreStart: 1 };

describe("resolvePreviewNombre (Phase 11 round 3: canonical folio owns V2 Preview ノンブル)", () => {
  it("V2: shows exactly the canonical folio — a TOC page's folio is shown even if a stale hideNombre prop says otherwise", () => {
    expect(resolvePreviewNombre({ ...base, hasCanonicalPage: true, canonicalFolioText: "1", hideNombre: true, pageNumber: 1 })).toEqual({ show: true, value: 1 });
    expect(resolvePreviewNombre({ ...base, hasCanonicalPage: true, canonicalFolioText: "12", pageNumber: 3 })).toEqual({ show: true, value: 12 });
  });

  it("V2: no canonical folio (ノンブル非表示 override / 1ページ目非表示 / hidden) → no Preview ノンブル", () => {
    expect(resolvePreviewNombre({ ...base, hasCanonicalPage: true, canonicalFolioText: undefined, pageNumber: 4 }).show).toBe(false);
    expect(resolvePreviewNombre({ ...base, nombrePosition: "hidden", hasCanonicalPage: true, canonicalFolioText: "4", pageNumber: 4 }).show).toBe(false);
  });

  it("LEGACY (no canonical page): unchanged prop-based rule", () => {
    expect(resolvePreviewNombre({ ...base, hasCanonicalPage: false, canonicalFolioText: undefined, pageNumber: 2 })).toEqual({ show: true, value: 2 });
    expect(resolvePreviewNombre({ ...base, hasCanonicalPage: false, canonicalFolioText: undefined, hideNombre: true, pageNumber: 2 }).show).toBe(false);
    expect(resolvePreviewNombre({ ...base, hasCanonicalPage: false, canonicalFolioText: undefined, hideNombreOnFirstPage: true, pageNumber: 1 }).show).toBe(false);
    expect(resolvePreviewNombre({ ...base, hasCanonicalPage: false, canonicalFolioText: undefined, nombreStart: 5, pageNumber: 3 }).value).toBe(7);
  });
});
