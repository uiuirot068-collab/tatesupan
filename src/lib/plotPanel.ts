// PLT-LOOP-003: the プロット side of the メモ・プロット panel.
//
// Reads a プロット帳 file (`spuntales-plot` v1) so the plot can be read beside
// the manuscript, chapter by chapter. The reader below is a copy of the one
// in プロット帳 (uiuirot068-collab/plotbook `src/lib/plotFile.ts` and
// `src/lib/plotModel.ts`); keep the two in step when the format changes.
//
// Safety rules (PLT concept §7): the plot is read-only here. It is kept in its
// own localStorage drawer, never in the manuscript, its settings, the memo or
// the cloud copy, and a file that is not exactly this shape is rejected
// instead of being half-loaded.

import { extractHeadingOffsets, type HeadingOffset } from "@/utils/tocGenerator";

// ---- the plot model (subset of plotbook src/lib/plotModel.ts) ----------------

export type SceneStatus = "todo" | "writing" | "done";

export const SCENE_STATUS_LABELS: Record<SceneStatus, string> = {
  todo: "まだ",
  writing: "書いている",
  done: "書けた",
};

export interface PlotScene {
  id: string;
  title: string;
  summary: string;
  characters: string;
  timePlace: string;
  memo: string;
  status: SceneStatus;
}

export interface PlotChapter {
  id: string;
  title: string;
  summary: string;
  scenes: PlotScene[];
}

export const FRAGMENT_TAGS = ["", "台詞", "情景", "人物", "設定", "ひらめき"] as const;
export type FragmentTag = (typeof FRAGMENT_TAGS)[number];

export interface PlotFragment {
  id: string;
  text: string;
  tag: FragmentTag;
  x: number;
  y: number;
  usedIn: { chapterId: string; sceneId: string } | null;
  createdAt: number;
}

export interface Plot {
  id: string;
  title: string;
  logline: string;
  chapters: PlotChapter[];
  fragments: PlotFragment[];
  createdAt: number;
  updatedAt: number;
}

export function chapterDisplayTitle(chapter: PlotChapter, index: number): string {
  return chapter.title.trim() || `第${index + 1}章`;
}

const NUMBERED_CHAPTER = /^(第\s*[0-9０-９一二三四五六七八九十百〇零壱弐参]+\s*[章話部幕]|序章|終章|序幕|終幕|プロローグ|エピローグ|prologue|epilogue)/i;

/** The chapter's heading as プロット帳 writes it into a manuscript: 「第1章　帰郷」. */
export function chapterHeading(chapter: PlotChapter, index: number): string {
  const name = chapter.title.replace(/[\r\n]+/g, " ").trim();
  if (!name) return `第${index + 1}章`;
  if (NUMBERED_CHAPTER.test(name)) return name;
  return `第${index + 1}章　${name}`;
}

export function sceneDisplayTitle(scene: PlotScene, index: number): string {
  return scene.title.trim() || `場面${index + 1}`;
}

export function plotDisplayTitle(plot: Pick<Plot, "title">): string {
  return plot.title.trim() || "無題のプロット";
}

// ---- the file reader (copy of plotbook src/lib/plotFile.ts) ------------------

export const PLOT_FILE_FORMAT = "spuntales-plot";
export const PLOT_FILE_VERSION = 1;

export const PLOT_LIMITS = {
  fileBytes: 5 * 1024 * 1024,
  chapters: 300,
  fragments: 2000,
  scenesPerChapter: 300,
  textLength: 20000,
  idLength: 100,
} as const;

export type PlotParseResult = { ok: true; plot: Plot } | { ok: false; error: string };

export function serializePlotFile(plot: Plot, now: Date = new Date()): string {
  return JSON.stringify({ format: PLOT_FILE_FORMAT, version: PLOT_FILE_VERSION, exportedAt: now.toISOString(), plot });
}

class PlotFileError extends Error {}

function fail(message: string): never {
  throw new PlotFileError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(source: Record<string, unknown>, key: string, where: string): string {
  const value = source[key];
  if (value === undefined) return "";
  if (typeof value !== "string") fail(`${where}の「${key}」が文字ではありません。`);
  if (value.length > PLOT_LIMITS.textLength) fail(`${where}の文章が長すぎます（${PLOT_LIMITS.textLength}字まで）。`);
  return value;
}

function readId(source: Record<string, unknown>, where: string): string {
  const value = source.id;
  if (typeof value !== "string" || value.length === 0 || value.length > PLOT_LIMITS.idLength) fail(`${where}の番号（id）が正しくありません。`);
  return value;
}

function readTime(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

const STATUSES = Object.keys(SCENE_STATUS_LABELS) as SceneStatus[];

function readScene(raw: unknown, where: string, seen: Set<string>): PlotScene {
  if (!isRecord(raw)) fail(`${where}の形が正しくありません。`);
  const id = readId(raw, where);
  if (seen.has(id)) fail(`${where}の番号（id）が重なっています。`);
  seen.add(id);
  const status = raw.status === undefined ? "todo" : raw.status;
  if (!STATUSES.includes(status as SceneStatus)) fail(`${where}の進み具合が正しくありません。`);
  return {
    id,
    title: readText(raw, "title", where),
    summary: readText(raw, "summary", where),
    characters: readText(raw, "characters", where),
    timePlace: readText(raw, "timePlace", where),
    memo: readText(raw, "memo", where),
    status: status as SceneStatus,
  };
}

function readFragment(raw: unknown, index: number, seen: Set<string>): PlotFragment {
  const where = `${index + 1}番目のかけら`;
  if (!isRecord(raw)) fail(`${where}の形が正しくありません。`);
  const id = readId(raw, where);
  if (seen.has(id)) fail(`${where}の番号（id）が重なっています。`);
  seen.add(id);
  const tag = raw.tag === undefined ? "" : raw.tag;
  if (!FRAGMENT_TAGS.includes(tag as FragmentTag)) fail(`${where}の種類が正しくありません。`);
  let usedIn: PlotFragment["usedIn"] = null;
  if (raw.usedIn !== undefined && raw.usedIn !== null) {
    const u = raw.usedIn;
    if (!isRecord(u) || typeof u.chapterId !== "string" || typeof u.sceneId !== "string") fail(`${where}の貼った先が正しくありません。`);
    usedIn = { chapterId: u.chapterId.slice(0, PLOT_LIMITS.idLength), sceneId: u.sceneId.slice(0, PLOT_LIMITS.idLength) };
  }
  const coord = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(20000, v)) : 0);
  return {
    id,
    text: readText(raw, "text", where),
    tag: tag as FragmentTag,
    x: coord(raw.x),
    y: coord(raw.y),
    usedIn,
    createdAt: readTime(raw, "createdAt"),
  };
}

function readChapter(raw: unknown, index: number, seen: Set<string>): PlotChapter {
  const where = `${index + 1}番目の章`;
  if (!isRecord(raw)) fail(`${where}の形が正しくありません。`);
  const id = readId(raw, where);
  if (seen.has(id)) fail(`${where}の番号（id）が重なっています。`);
  seen.add(id);
  if (!Array.isArray(raw.scenes)) fail(`${where}に場面の一覧がありません。`);
  if (raw.scenes.length > PLOT_LIMITS.scenesPerChapter) fail(`${where}の場面が多すぎます（${PLOT_LIMITS.scenesPerChapter}まで）。`);
  return {
    id,
    title: readText(raw, "title", where),
    summary: readText(raw, "summary", where),
    scenes: raw.scenes.map((s, si) => readScene(s, `${where}の${si + 1}番目の場面`, seen)),
  };
}

/** Strictly reads a プロット帳 file. Never returns a partially-read plot. */
export function parsePlotFile(text: string): PlotParseResult {
  try {
    if (text.length > PLOT_LIMITS.fileBytes) fail("ファイルが大きすぎます。");
    let data: unknown;
    try {
      data = JSON.parse(text.replace(/^﻿/, ""));
    } catch {
      fail("プロット帳のファイルではないようです。");
    }
    if (!isRecord(data) || data.format !== PLOT_FILE_FORMAT) fail("プロット帳のファイルではないようです。");
    if (data.version !== PLOT_FILE_VERSION) fail("このファイルは新しい版のプロット帳で作られています。");
    const raw = data.plot;
    if (!isRecord(raw)) fail("プロットの中身がありません。");
    if (!Array.isArray(raw.chapters) || raw.chapters.length === 0) fail("章がひとつもありません。");
    if (raw.chapters.length > PLOT_LIMITS.chapters) fail(`章が多すぎます（${PLOT_LIMITS.chapters}まで）。`);
    const rawFragments = raw.fragments === undefined ? [] : raw.fragments;
    if (!Array.isArray(rawFragments)) fail("かけらの一覧の形が正しくありません。");
    if (rawFragments.length > PLOT_LIMITS.fragments) fail(`かけらが多すぎます（${PLOT_LIMITS.fragments}まで）。`);
    const seen = new Set<string>();
    const fragmentIds = new Set<string>();
    const plot: Plot = {
      id: readId(raw, "プロット"),
      title: readText(raw, "title", "プロット"),
      logline: readText(raw, "logline", "プロット"),
      chapters: raw.chapters.map((c, ci) => readChapter(c, ci, seen)),
      fragments: rawFragments.map((f, fi) => readFragment(f, fi, fragmentIds)),
      createdAt: readTime(raw, "createdAt"),
      updatedAt: readTime(raw, "updatedAt"),
    };
    return { ok: true, plot };
  } catch (error) {
    if (error instanceof PlotFileError) return { ok: false, error: error.message };
    return { ok: false, error: "ファイルを読めませんでした。" };
  }
}

/** Normalises a heading so 全角/半角 and spacing differences still match. */
export function normalizeHeading(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

/**
 * Which chapter belongs to a manuscript heading. Matches by name only and
 * returns -1 when nothing (or more than one chapter) matches, so the panel
 * never jumps to a guessed chapter.
 */
export function chapterIndexForHeading(plot: Plot, heading: string): number {
  const key = normalizeHeading(heading);
  if (!key) return -1;
  let found = -1;
  for (let i = 0; i < plot.chapters.length; i += 1) {
    const names = new Set([normalizeHeading(chapterHeading(plot.chapters[i], i)), normalizeHeading(chapterDisplayTitle(plot.chapters[i], i))]);
    if (names.has(key)) {
      if (found >= 0) return -1;
      found = i;
    }
  }
  return found;
}

// ---- following the manuscript ------------------------------------------------

/** The `#` / `■` heading the cursor is under, or null before the first heading. */
export function headingAtCursor(headings: HeadingOffset[], cursorIndex: number | null): string | null {
  if (cursorIndex === null || headings.length === 0) return null;
  let lo = 0;
  let hi = headings.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (headings[mid].index <= cursorIndex) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found >= 0 ? headings[found].title : null;
}

export function manuscriptHeadings(content: string): HeadingOffset[] {
  return extractHeadingOffsets(content);
}

// ---- where the plot is kept (its own drawer, per work) ----------------------

export interface PlotPanelStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PLOT_PREFIX = "tatespun:plot-panel:v1:";
export const MEMO_PANEL_TAB_KEY = "tatespun:memo-panel-tab:v1";
export type MemoPanelTab = "memo" | "plot";

export function plotPanelStorageKey(workIdentity: string): string {
  return `${PLOT_PREFIX}${workIdentity}`;
}

/** The plot kept for this work, re-checked with the same strict reader. */
export function readStoredPlot(storage: PlotPanelStorage, key: string): Plot | null {
  try {
    const text = storage.getItem(key);
    if (!text) return null;
    const parsed = parsePlotFile(text);
    return parsed.ok ? parsed.plot : null;
  } catch {
    return null;
  }
}

/** Returns false when the browser would not keep it (full or blocked storage). */
export function writeStoredPlot(storage: PlotPanelStorage, key: string, plot: Plot): boolean {
  try {
    storage.setItem(key, serializePlotFile(plot));
    return true;
  } catch {
    return false;
  }
}

export function removeStoredPlot(storage: PlotPanelStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // nothing kept, nothing to remove
  }
}

export function readMemoPanelTab(storage: PlotPanelStorage): MemoPanelTab {
  try {
    return storage.getItem(MEMO_PANEL_TAB_KEY) === "plot" ? "plot" : "memo";
  } catch {
    return "memo";
  }
}

export function writeMemoPanelTab(storage: PlotPanelStorage, tab: MemoPanelTab): void {
  try {
    storage.setItem(MEMO_PANEL_TAB_KEY, tab);
  } catch {
    // remembering the tab is only a convenience
  }
}
