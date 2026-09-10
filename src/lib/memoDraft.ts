export interface MemoDraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PREFIX = "tatespun:memo-draft:v1:";

export function memoDraftStorageKey(workIdentity: string): string {
  return `${PREFIX}${workIdentity}`;
}

export function readMemoDraft(storage: MemoDraftStorage, key: string): string | null {
  return storage.getItem(key);
}

export function writeMemoDraft(storage: MemoDraftStorage, key: string, draft: string): void {
  storage.setItem(key, draft);
}

export function clearMemoDraft(storage: MemoDraftStorage, key: string): void {
  storage.removeItem(key);
}

export function canConfirmMemoDraft(draft: string, confirmedMemo: string): boolean {
  return !(confirmedMemo.trim().length > 0 && draft.trim().length === 0);
}
