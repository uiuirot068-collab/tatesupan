"use client";

import { useCallback } from "react";
import { createJsonLocalStorageHook } from "./createJsonLocalStorageHook";
import type { WritingCheckDictionaryEntry } from "@/lib/writingCheckEngine";

// わたしの辞書 (表記ゆれ) -- browser-local only, never transmitted.
const STORAGE_KEY = "tatespun_writing_check_dictionary";
const useDictionaryStorage = createJsonLocalStorageHook<WritingCheckDictionaryEntry[]>(STORAGE_KEY, []);

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `dict-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** CRUD for the user's local 表記ゆれ dictionary (文章チェック設定 → わたしの辞書). */
export function useWritingCheckDictionary() {
  const [entries, setEntries] = useDictionaryStorage();

  const addEntry = useCallback(
    (preferred: string, variants: string[]) => {
      const trimmedPreferred = preferred.trim();
      const trimmedVariants = variants.map((v) => v.trim()).filter((v) => v.length > 0);
      if (!trimmedPreferred || trimmedVariants.length === 0) return;
      setEntries([...entries, { id: makeId(), preferred: trimmedPreferred, variants: trimmedVariants }]);
    },
    [entries, setEntries]
  );

  const updateEntry = useCallback(
    (id: string, preferred: string, variants: string[]) => {
      const trimmedPreferred = preferred.trim();
      const trimmedVariants = variants.map((v) => v.trim()).filter((v) => v.length > 0);
      if (!trimmedPreferred || trimmedVariants.length === 0) return;
      setEntries(entries.map((e) => (e.id === id ? { id, preferred: trimmedPreferred, variants: trimmedVariants } : e)));
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
