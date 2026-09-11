import { describe, expect, it } from "vitest";
import {
  CHECKLIST_PRESETS,
  addPersonalChecklist,
  beginPdfExportChecklistAttempt,
  completionFor,
  createDefaultChecklistState,
  parseChecklistState,
  pdfExportChecklistAttemptProgress,
  pdfExportChecklistFor,
  removePersonalChecklist,
  removePersonalChecklistWithConfirmation,
  resetChecklistSet,
  setPdfExportChecklist,
  updatePdfExportChecklistAttempt,
  updateChecklistSet,
} from "./checklistModel";

describe("preflight checklist model", () => {
  it("creates reusable editable local presets with unchecked items", () => {
    const state = createDefaultChecklistState();
    expect(state.sets).toHaveLength(CHECKLIST_PRESETS.length);
    expect(state.sets[0].items.map((item) => item.text)).toContain("奥付の日付を確認した");
    expect(state.sets.every((set) => set.items.every((item) => !item.checked))).toBe(true);
  });

  it("edits item text and checked state without changing another set", () => {
    const initial = createDefaultChecklistState();
    const active = initial.sets[0];
    const next = updateChecklistSet(initial, active.id, (set) => ({
      ...set,
      items: set.items.map((item, index) => (index === 0 ? { ...item, text: "変更後", checked: true } : item)),
    }));
    expect(next.sets[0].items[0]).toMatchObject({ text: "変更後", checked: true });
    expect(next.sets[1]).toEqual(initial.sets[1]);
  });

  it("restores preset text and checks, while personal reset keeps text", () => {
    const initial = createDefaultChecklistState();
    const preset = initial.sets[0];
    const edited = updateChecklistSet(initial, preset.id, (set) => ({ ...set, items: [{ ...set.items[0], text: "changed", checked: true }] }));
    const restored = resetChecklistSet(edited, preset.id);
    expect(restored.sets[0].items.map((item) => item.text)).toEqual(CHECKLIST_PRESETS[0].items);
    expect(restored.sets[0].items.every((item) => !item.checked)).toBe(true);

    const personal = addPersonalChecklist(restored, "personal-1");
    const withItem = updateChecklistSet(personal, "personal-1", (set) => ({ ...set, items: [{ id: "mine", text: "残す", checked: true }] }));
    expect(resetChecklistSet(withItem, "personal-1").sets.at(-1)?.items).toEqual([{ id: "mine", text: "残す", checked: false }]);
  });

  it("adds/removes personal sets but protects built-in presets", () => {
    const initial = createDefaultChecklistState();
    const added = addPersonalChecklist(initial, "personal-1", "自分用");
    expect(added.activeSetId).toBe("personal-1");
    expect(removePersonalChecklist(added, "personal-1").sets).toHaveLength(initial.sets.length);
    expect(removePersonalChecklist(initial, initial.sets[0].id)).toEqual(initial);
  });

  it("requires one confirmation before deleting a personal list and preserves it on cancel", () => {
    const state = addPersonalChecklist(createDefaultChecklistState(), "personal-1", "入稿前の自分用");
    const cancelled = removePersonalChecklistWithConfirmation(state, "personal-1", (name) => {
      expect(name).toBe("入稿前の自分用");
      return false;
    });
    expect(cancelled).toBe(state);

    const confirmed = removePersonalChecklistWithConfirmation(state, "personal-1", () => true);
    expect(confirmed.sets.some((set) => set.id === "personal-1")).toBe(false);
  });

  it("restores edited preset text and checked state after a serialized browser reload", () => {
    const initial = createDefaultChecklistState();
    const preset = initial.sets[0];
    const edited = updateChecklistSet(initial, preset.id, (set) => ({
      ...set,
      items: set.items.map((item, index) => index === 0 ? { ...item, text: "再読して確認", checked: true } : item),
    }));
    const reloaded = parseChecklistState(JSON.stringify(edited));
    expect(reloaded.sets[0].items[0]).toMatchObject({ text: "再読して確認", checked: true });
  });

  it("recovers safely from invalid JSON and sanitizes malformed entries", () => {
    expect(parseChecklistState("not-json")).toEqual(createDefaultChecklistState());
    const parsed = parseChecklistState(JSON.stringify({
      version: 1,
      activeSetId: "missing",
      sets: [
        { id: "valid", name: " Valid ", presetId: null, items: [{ id: "a", text: "A", checked: true }, { id: "a", text: "duplicate", checked: false }] },
        { id: "broken", items: [] },
      ],
    }));
    expect(parsed.activeSetId).toBe("valid");
    expect(parsed.pdfExportSetId).toBeNull();
    expect(parsed.sets).toEqual([{ id: "valid", name: "Valid", presetId: null, items: [{ id: "a", text: "A", checked: true }] }]);
  });

  it("reports completion only for a non-empty fully checked set", () => {
    expect(completionFor({ id: "empty", name: "empty", presetId: null, items: [] })).toEqual({ checked: 0, total: 0, complete: false });
    expect(completionFor({ id: "x", name: "x", presetId: null, items: [{ id: "1", text: "a", checked: true }] })).toEqual({ checked: 1, total: 1, complete: true });
  });
});

describe("PDF export checklist selection", () => {
  it("keeps the old direct PDF flow when no list is selected", () => {
    const state = createDefaultChecklistState();
    expect(state.pdfExportSetId).toBeNull();
    expect(pdfExportChecklistFor(state)).toBeNull();
    expect(beginPdfExportChecklistAttempt(state)).toBeNull();
  });

  it("stores exactly one canonical list ID and can replace or clear it", () => {
    const initial = createDefaultChecklistState();
    const [listA, listB] = initial.sets;
    const selectedA = setPdfExportChecklist(initial, listA.id);
    expect(selectedA.pdfExportSetId).toBe(listA.id);
    expect(pdfExportChecklistFor(selectedA)?.name).toBe(listA.name);

    const selectedB = setPdfExportChecklist(selectedA, listB.id);
    expect(selectedB.pdfExportSetId).toBe(listB.id);
    expect(selectedB.sets.filter((set) => set.id === selectedB.pdfExportSetId)).toHaveLength(1);

    const cleared = setPdfExportChecklist(selectedB, null);
    expect(cleared.pdfExportSetId).toBeNull();
    expect(setPdfExportChecklist(cleared, "missing")).toBe(cleared);
  });

  it("preserves selection through rename/reset and follows the current name", () => {
    const initial = createDefaultChecklistState();
    const selectedId = initial.sets[0].id;
    const selected = setPdfExportChecklist(initial, selectedId);
    const renamed = updateChecklistSet(selected, selectedId, (set) => ({ ...set, name: "最終確認（改訂）" }));
    expect(renamed.pdfExportSetId).toBe(selectedId);
    expect(pdfExportChecklistFor(renamed)?.name).toBe("最終確認（改訂）");
    expect(resetChecklistSet(renamed, selectedId).pdfExportSetId).toBe(selectedId);
  });

  it("clears a selected personal-list reference on deletion and while parsing stale storage", () => {
    const added = addPersonalChecklist(createDefaultChecklistState(), "personal-export", "自分用最終確認");
    const selected = setPdfExportChecklist(added, "personal-export");
    const deleted = removePersonalChecklistWithConfirmation(selected, "personal-export", () => true);
    expect(deleted.pdfExportSetId).toBeNull();

    const stale = parseChecklistState(JSON.stringify({ ...selected, pdfExportSetId: "missing" }));
    expect(stale.pdfExportSetId).toBeNull();
  });

  it("persists only the selected list reference while every PDF attempt starts unchecked", () => {
    const initial = createDefaultChecklistState();
    const selectedId = initial.sets[0].id;
    const editorChecked = updateChecklistSet(
      setPdfExportChecklist(initial, selectedId),
      selectedId,
      (set) => ({ ...set, items: set.items.map((item) => ({ ...item, checked: true })) })
    );
    const reloaded = parseChecklistState(JSON.stringify(editorChecked));
    const first = beginPdfExportChecklistAttempt(reloaded)!;
    expect(first.checkedItemIds).toEqual([]);

    const partial = updatePdfExportChecklistAttempt(first, first.items[0].id, true);
    expect(pdfExportChecklistAttemptProgress(partial)).toEqual({
      checked: 1,
      total: first.items.length,
      complete: false,
    });
    const allChecked = first.items.reduce(
      (attempt, item) => updatePdfExportChecklistAttempt(attempt, item.id, true),
      first
    );
    expect(pdfExportChecklistAttemptProgress(allChecked).complete).toBe(true);

    const second = beginPdfExportChecklistAttempt(reloaded)!;
    expect(second.checkedItemIds).toEqual([]);
    expect(pdfExportChecklistAttemptProgress(second).checked).toBe(0);
  });

  it("allows a selected zero-item list to proceed without a deadlock", () => {
    const personal = addPersonalChecklist(createDefaultChecklistState(), "empty", "空の確認リスト");
    const attempt = beginPdfExportChecklistAttempt(setPdfExportChecklist(personal, "empty"))!;
    expect(attempt.items).toEqual([]);
    expect(pdfExportChecklistAttemptProgress(attempt)).toEqual({ checked: 0, total: 0, complete: true });
  });
});
