"use client";

import { useCallback } from "react";
import { createJsonLocalStorageHook } from "./createJsonLocalStorageHook";
import {
  removePronunciationEntry,
  upsertPronunciationEntry,
  type PronunciationEntry,
} from "@/lib/readAloudPronunciation";

// TSP-B4 (Revision 3) 音読の読み辞書 -- browser-local only, never transmitted; same storage
// model as 文章チェックβ's わたしの辞書 (`useWritingCheckDictionary.ts`).
const STORAGE_KEY = "tatespun.readAloudPronunciation.v1";
const usePronunciationStorage = createJsonLocalStorageHook<PronunciationEntry[]>(STORAGE_KEY, []);

/** CRUD for the user's local 音読の読み辞書 (Review Hub → 音読β → 読みを登録 / 管理). */
export function useReadAloudPronunciation() {
  const [entries, setEntries] = usePronunciationStorage();

  const upsertEntry = useCallback(
    (surface: string, reading: string) => setEntries(upsertPronunciationEntry(entries, surface, reading)),
    [entries, setEntries],
  );

  const removeEntry = useCallback(
    (id: string) => setEntries(removePronunciationEntry(entries, id)),
    [entries, setEntries],
  );

  return { entries, upsertEntry, removeEntry };
}
