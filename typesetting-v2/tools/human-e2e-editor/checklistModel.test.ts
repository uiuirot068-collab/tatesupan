import { describe, expect, it } from "vitest";
import {
  CHECKLIST_PRESETS,
  addPersonalChecklist,
  completionFor,
  createDefaultChecklistState,
  parseChecklistState,
  removePersonalChecklist,
  removePersonalChecklistWithConfirmation,
  resetChecklistSet,
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
    expect(parsed.sets).toEqual([{ id: "valid", name: "Valid", presetId: null, items: [{ id: "a", text: "A", checked: true }] }]);
  });

  it("reports completion only for a non-empty fully checked set", () => {
    expect(completionFor({ id: "empty", name: "empty", presetId: null, items: [] })).toEqual({ checked: 0, total: 0, complete: false });
    expect(completionFor({ id: "x", name: "x", presetId: null, items: [{ id: "1", text: "a", checked: true }] })).toEqual({ checked: 1, total: 1, complete: true });
  });
});
