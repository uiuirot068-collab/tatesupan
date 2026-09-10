"use client";

import { useEffect, useMemo, useState } from "react";
import ViewportModal from "./ViewportModal";
import {
  CHECKLIST_STORAGE_KEY,
  addPersonalChecklist,
  completionFor,
  createDefaultChecklistState,
  parseChecklistState,
  removePersonalChecklistWithConfirmation,
  resetChecklistSet,
  updateChecklistSet,
  type ChecklistState,
} from "../../typesetting-v2/tools/human-e2e-editor/checklistModel";

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ChecklistPanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<ChecklistState>(() =>
    typeof window === "undefined"
      ? createDefaultChecklistState()
      : parseChecklistState(localStorage.getItem(CHECKLIST_STORAGE_KEY))
  );
  useEffect(() => {
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const active = useMemo(() => state.sets.find((set) => set.id === state.activeSetId) ?? state.sets[0], [state]);
  const completion = completionFor(active);
  const updateActive = (updater: Parameters<typeof updateChecklistSet>[2]) => {
    setState((current) => updateChecklistSet(current, active.id, updater));
  };

  return (
    <ViewportModal title="完成前マイチェックリスト" titleId="preflight-checklist-title" closeLabel="チェックリストを閉じる" onClose={onClose} panelClassName="max-w-xl">
      <div className="grid gap-4">
        <label className="grid gap-1 text-sm"><span>リスト</span><select className="rounded border border-ink/20 bg-base px-3 py-2" value={active.id} onChange={(event) => setState((current) => ({ ...current, activeSetId: event.target.value }))}>{state.sets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</select></label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded border border-ink/20 px-3 py-1.5 text-xs" onClick={() => setState((current) => addPersonalChecklist(current, nextId("personal")))}>自分用リストを作る</button>
          <button type="button" className="rounded border border-ink/20 px-3 py-1.5 text-xs" onClick={() => setState((current) => resetChecklistSet(current, active.id))}>リセット</button>
          {active.presetId === null && <button type="button" className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-700" onClick={() => setState((current) => removePersonalChecklistWithConfirmation(current, active.id, (name) => confirm(`「${name}」を削除しますか？`)))}>このリストを削除</button>}
        </div>
        <label className="grid gap-1 text-sm"><span>リスト名</span><input className="rounded border border-ink/20 bg-base px-3 py-2" value={active.name} onChange={(event) => updateActive((set) => ({ ...set, name: event.target.value }))} /></label>
        <p aria-live="polite" className={`rounded px-3 py-2 text-sm ${completion.complete ? "bg-green-50 text-green-800" : "bg-ink/5 text-ink/65"}`}>{completion.complete ? "すべて確認できました" : `${completion.checked} / ${completion.total} 項目を確認済み`}</p>
        <ul className="grid gap-2">
          {active.items.map((item) => <li key={item.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2"><input type="checkbox" checked={item.checked} onChange={(event) => updateActive((set) => ({ ...set, items: set.items.map((candidate) => candidate.id === item.id ? { ...candidate, checked: event.target.checked } : candidate) }))} /><input className={`min-w-0 border-b border-ink/15 bg-transparent px-1 py-2 text-sm ${item.checked ? "text-ink/45 line-through" : ""}`} value={item.text} onChange={(event) => updateActive((set) => ({ ...set, items: set.items.map((candidate) => candidate.id === item.id ? { ...candidate, text: event.target.value } : candidate) }))} /><button type="button" aria-label="項目を削除" className="rounded px-2 py-1 text-ink/45 hover:bg-ink/5" onClick={() => updateActive((set) => ({ ...set, items: set.items.filter((candidate) => candidate.id !== item.id) }))}>×</button></li>)}
        </ul>
        <button type="button" className="rounded border border-ink/20 px-3 py-2 text-sm" onClick={() => updateActive((set) => ({ ...set, items: [...set.items, { id: nextId(`${set.id}-item`), text: "", checked: false }] }))}>項目を追加</button>
        <p className="text-xs leading-relaxed text-ink/55">チェック内容はこのブラウザにだけ保存され、外部へ送信されません。</p>
      </div>
    </ViewportModal>
  );
}
