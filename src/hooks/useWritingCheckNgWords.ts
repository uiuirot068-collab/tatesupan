"use client";

import { useCallback } from "react";
import { createJsonLocalStorageHook } from "./createJsonLocalStorageHook";
import type { WritingCheckNgWordEntry } from "@/lib/writingCheckEngine";

// NGワード -- browser-local only, never transmitted.
const STORAGE_KEY = "tatespun_writing_check_ngwords";
const useNgWordStorage = createJsonLocalStorageHook<WritingCheckNgWordEntry[]>(STORAGE_KEY, []);

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `ng-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** CRUD for the user's local NGワード list (文章チェック設定 → NGワード). */
export function useWritingCheckNgWords() {
  const [entries, setEntries] = useNgWordStorage();

  const addEntry = useCallback(
    (term: string, note?: string) => {
      const trimmedTerm = term.trim();
      if (!trimmedTerm) return;
      const trimmedNote = note?.trim();
      setEntries([...entries, { id: makeId(), term: trimmedTerm, ...(trimmedNote ? { note: trimmedNote } : {}) }]);
    },
    [entries, setEntries]
  );

  const updateEntry = useCallback(
    (id: string, term: string, note?: string) => {
      const trimmedTerm = term.trim();
      if (!trimmedTerm) return;
      const trimmedNote = note?.trim();
      setEntries(entries.map((e) => (e.id === id ? { id, term: trimmedTerm, ...(trimmedNote ? { note: trimmedNote } : {}) } : e)));
    },
    [entries, setEntries]
  );

  const removeEntry = useCallback(
    (id: string) => {
      setEntries(entries.filter((e) => e.id !== id));
    },
    [entries, setEntries]
  );

  return { entries, addEntry, updateEntry, removeEntry };
}
