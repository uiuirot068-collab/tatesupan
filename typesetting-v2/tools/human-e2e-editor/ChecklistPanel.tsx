import { useEffect, useMemo, useState } from "react";
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
} from "./checklistModel";

interface ChecklistPanelProps {
  onClose: () => void;
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ChecklistPanel({ onClose }: ChecklistPanelProps) {
  const [state, setState] = useState<ChecklistState>(() => createDefaultChecklistState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(parseChecklistState(window.localStorage.getItem(CHECKLIST_STORAGE_KEY)));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const active = useMemo(
    () => state.sets.find((set) => set.id === state.activeSetId) ?? state.sets[0],
    [state],
  );
  const completion = completionFor(active);

  const updateActive = (updater: Parameters<typeof updateChecklistSet>[2]) => {
    setState((current) => updateChecklistSet(current, active.id, updater));
  };

  return (
    <section className="side-panel checklist-panel" aria-labelledby="checklist-title">
      <header className="panel-header">
        <div>
          <p className="eyebrow">人が確認するためのリスト</p>
          <h2 id="checklist-title">完成前マイチェックリスト</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="チェックリストを閉じる">×</button>
      </header>

      <div className="panel-body">
        <label className="field">
          <span>リスト</span>
          <select value={active.id} onChange={(event) => setState((current) => ({ ...current, activeSetId: event.target.value }))}>
            {state.sets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}
          </select>
        </label>

        <div className="checklist-actions">
          <button type="button" onClick={() => setState((current) => addPersonalChecklist(current, nextId("personal")))}>自分用リストを作る</button>
          <button type="button" onClick={() => setState((current) => resetChecklistSet(current, active.id))}>リセット</button>
          {active.presetId === null && (
            <button
              className="danger-text"
              type="button"
              onClick={() => setState((current) => removePersonalChecklistWithConfirmation(
                current,
                active.id,
                (listName) => window.confirm(`「${listName}」を削除します。元に戻せません。削除してよろしいですか？`),
              ))}
            >このリストを削除</button>
          )}
        </div>

        <label className="field">
          <span>リスト名</span>
          <input value={active.name} onChange={(event) => updateActive((set) => ({ ...set, name: event.target.value }))} />
        </label>

        <p className={`completion ${completion.complete ? "is-complete" : ""}`} aria-live="polite">
          {completion.complete ? "すべて確認できました" : `${completion.checked} / ${completion.total} 項目を確認済み`}
        </p>

        <ul className="checklist-items">
          {active.items.map((item) => (
            <li key={item.id}>
              <input
                type="checkbox"
                checked={item.checked}
                aria-label={`${item.text || "無題の項目"}を確認済みにする`}
                onChange={(event) => updateActive((set) => ({
                  ...set,
                  items: set.items.map((candidate) => candidate.id === item.id ? { ...candidate, checked: event.target.checked } : candidate),
                }))}
              />
              <input
                className={item.checked ? "checked-text" : ""}
                value={item.text}
                aria-label="チェック項目"
                onChange={(event) => updateActive((set) => ({
                  ...set,
                  items: set.items.map((candidate) => candidate.id === item.id ? { ...candidate, text: event.target.value } : candidate),
                }))}
              />
              <button
                className="remove-item"
                type="button"
                aria-label={`${item.text || "無題の項目"}を削除`}
                onClick={() => updateActive((set) => ({ ...set, items: set.items.filter((candidate) => candidate.id !== item.id) }))}
              >×</button>
            </li>
          ))}
        </ul>

        <button
          className="wide-button"
          type="button"
          onClick={() => updateActive((set) => ({
            ...set,
            items: [...set.items, { id: nextId(`${set.id}-item`), text: "", checked: false }],
          }))}
        >項目を追加</button>

        <p className="privacy-note">このチェックリストはこのブラウザのlocalStorageだけに保存されます。原稿や項目を外部へ送信しません。</p>
      </div>
    </section>
  );
}
