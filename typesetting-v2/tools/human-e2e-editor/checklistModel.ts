export const CHECKLIST_STORAGE_KEY = "tatespun:v2:preflight-checklists";
export const CHECKLIST_SCHEMA_VERSION = 1 as const;

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface ChecklistSet {
  id: string;
  name: string;
  presetId: string | null;
  items: ChecklistItem[];
}

export interface ChecklistState {
  version: typeof CHECKLIST_SCHEMA_VERSION;
  activeSetId: string;
  /** The one checklist shown before PDF export. Null keeps the legacy direct flow. */
  pdfExportSetId: string | null;
  sets: ChecklistSet[];
}

export interface PdfExportChecklistAttempt {
  setId: string;
  name: string;
  items: { id: string; text: string }[];
  checkedItemIds: string[];
}

interface ChecklistPreset {
  id: string;
  name: string;
  items: string[];
}

export const CHECKLIST_PRESETS: readonly ChecklistPreset[] = [
  {
    id: "submission",
    name: "入稿前おすすめ",
    items: [
      "奥付の日付を確認した",
      "用紙サイズと段組を確認した",
      "よくある誤字・置換漏れを確認した",
      "ノンブルと柱を確認した",
      "PDFとJPGの最終ページまで確認した",
    ],
  },
  {
    id: "book",
    name: "本づくり最終確認",
    items: [
      "表紙・本文・奥付の書名をそろえた",
      "目次のページ番号を確認した",
      "ルビと縦中横を確認した",
      "画像の向き・比率・解像感を確認した",
      "印刷用データを別名で保存した",
    ],
  },
  {
    id: "web",
    name: "Web公開前",
    items: [
      "公開タイトルと本文を確認した",
      "意図しない個人情報がないことを確認した",
      "Web閲覧用のページ表示を確認した",
      "画像と代替テキストを確認した",
    ],
  },
] as const;

function itemId(setId: string, index: number): string {
  return `${setId}-item-${index + 1}`;
}

export function setFromPreset(presetId: string): ChecklistSet {
  const preset = CHECKLIST_PRESETS.find((candidate) => candidate.id === presetId);
  if (!preset) throw new Error(`Unknown checklist preset: ${presetId}`);
  const id = `preset-${preset.id}`;
  return {
    id,
    name: preset.name,
    presetId: preset.id,
    items: preset.items.map((text, index) => ({ id: itemId(id, index), text, checked: false })),
  };
}

export function createDefaultChecklistState(): ChecklistState {
  const sets = CHECKLIST_PRESETS.map((preset) => setFromPreset(preset.id));
  return {
    version: CHECKLIST_SCHEMA_VERSION,
    activeSetId: sets[0].id,
    pdfExportSetId: null,
    sets,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeSet(value: unknown): ChecklistSet | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ChecklistSet>;
  if (!isNonEmptyString(candidate.id) || !isNonEmptyString(candidate.name) || !Array.isArray(candidate.items)) return null;
  const seen = new Set<string>();
  const items = candidate.items.flatMap((raw): ChecklistItem[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Partial<ChecklistItem>;
    if (!isNonEmptyString(item.id) || typeof item.text !== "string" || typeof item.checked !== "boolean" || seen.has(item.id)) return [];
    seen.add(item.id);
    return [{ id: item.id, text: item.text, checked: item.checked }];
  });
  return {
    id: candidate.id,
    name: candidate.name.trim(),
    presetId: typeof candidate.presetId === "string" ? candidate.presetId : null,
    items,
  };
}

export function parseChecklistState(raw: string | null): ChecklistState {
  if (!raw) return createDefaultChecklistState();
  try {
    const candidate = JSON.parse(raw) as Partial<ChecklistState>;
    if (candidate.version !== CHECKLIST_SCHEMA_VERSION || !Array.isArray(candidate.sets)) return createDefaultChecklistState();
    const seen = new Set<string>();
    const sets = candidate.sets.flatMap((value): ChecklistSet[] => {
      const set = normalizeSet(value);
      if (!set || seen.has(set.id)) return [];
      seen.add(set.id);
      return [set];
    });
    if (sets.length === 0) return createDefaultChecklistState();
    const activeSetId = sets.some((set) => set.id === candidate.activeSetId) ? candidate.activeSetId! : sets[0].id;
    const pdfExportSetId = typeof candidate.pdfExportSetId === "string"
      && sets.some((set) => set.id === candidate.pdfExportSetId)
      ? candidate.pdfExportSetId
      : null;
    return { version: CHECKLIST_SCHEMA_VERSION, activeSetId, pdfExportSetId, sets };
  } catch {
    return createDefaultChecklistState();
  }
}

export function updateChecklistSet(state: ChecklistState, setId: string, updater: (set: ChecklistSet) => ChecklistSet): ChecklistState {
  return { ...state, sets: state.sets.map((set) => (set.id === setId ? updater(set) : set)) };
}

export function resetChecklistSet(state: ChecklistState, setId: string): ChecklistState {
  const current = state.sets.find((set) => set.id === setId);
  if (!current) return state;
  if (current.presetId) {
    const restored = setFromPreset(current.presetId);
    return updateChecklistSet(state, setId, () => ({ ...restored, id: setId }));
  }
  return updateChecklistSet(state, setId, (set) => ({ ...set, items: set.items.map((item) => ({ ...item, checked: false })) }));
}

export function addPersonalChecklist(state: ChecklistState, id: string, name = "新しいチェックリスト"): ChecklistState {
  if (!isNonEmptyString(id) || state.sets.some((set) => set.id === id)) return state;
  const set: ChecklistSet = { id, name, presetId: null, items: [] };
  return { ...state, activeSetId: id, sets: [...state.sets, set] };
}

export function removePersonalChecklist(state: ChecklistState, setId: string): ChecklistState {
  const target = state.sets.find((set) => set.id === setId);
  if (!target || target.presetId !== null || state.sets.length === 1) return state;
  const sets = state.sets.filter((set) => set.id !== setId);
  return {
    ...state,
    sets,
    activeSetId: state.activeSetId === setId ? sets[0].id : state.activeSetId,
    pdfExportSetId: state.pdfExportSetId === setId ? null : state.pdfExportSetId,
  };
}

export function removePersonalChecklistWithConfirmation(
  state: ChecklistState,
  setId: string,
  confirmDeletion: (listName: string) => boolean
): ChecklistState {
  const target = state.sets.find((set) => set.id === setId);
  if (!target || target.presetId !== null) return state;
  return confirmDeletion(target.name) ? removePersonalChecklist(state, setId) : state;
}

export function completionFor(set: ChecklistSet): { checked: number; total: number; complete: boolean } {
  const checked = set.items.filter((item) => item.checked).length;
  return { checked, total: set.items.length, complete: set.items.length > 0 && checked === set.items.length };
}

/** Stores one canonical list reference, never independent per-list flags. */
export function setPdfExportChecklist(state: ChecklistState, setId: string | null): ChecklistState {
  if (setId !== null && !state.sets.some((set) => set.id === setId)) return state;
  if (state.pdfExportSetId === setId) return state;
  return { ...state, pdfExportSetId: setId };
}

export function pdfExportChecklistFor(state: ChecklistState): ChecklistSet | null {
  if (!state.pdfExportSetId) return null;
  return state.sets.find((set) => set.id === state.pdfExportSetId) ?? null;
}

/**
 * Creates a fresh, non-persisted Human Gate for one PDF attempt. Existing
 * editor checklist completion is intentionally ignored.
 */
export function beginPdfExportChecklistAttempt(state: ChecklistState): PdfExportChecklistAttempt | null {
  const set = pdfExportChecklistFor(state);
  if (!set) return null;
  return {
    setId: set.id,
    name: set.name,
    items: set.items.map(({ id, text }) => ({ id, text })),
    checkedItemIds: [],
  };
}

export function updatePdfExportChecklistAttempt(
  attempt: PdfExportChecklistAttempt,
  itemId: string,
  checked: boolean
): PdfExportChecklistAttempt {
  if (!attempt.items.some((item) => item.id === itemId)) return attempt;
  const nextChecked = new Set(attempt.checkedItemIds);
  if (checked) nextChecked.add(itemId);
  else nextChecked.delete(itemId);
  return { ...attempt, checkedItemIds: [...nextChecked] };
}

export function pdfExportChecklistAttemptProgress(
  attempt: PdfExportChecklistAttempt
): { checked: number; total: number; complete: boolean } {
  const itemIds = new Set(attempt.items.map((item) => item.id));
  const checked = new Set(attempt.checkedItemIds.filter((id) => itemIds.has(id))).size;
  const total = attempt.items.length;
  return { checked, total, complete: total === 0 || checked === total };
}
