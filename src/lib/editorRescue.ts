/**
 * TSP-SAFE-003: the last text the editor showed, kept in this tab's memory so
 * the error screen can hand it back even when the editor itself crashed.
 * Saving to this browser still goes through the save queue; this is only the
 * way out when the screen is gone (TXT, copy, or a new work on the bookshelf).
 */

export interface EditorRescue {
  docId: number | null;
  title: string;
  content: string;
  plotNote: string;
  /** The work's page settings (PageSettings), kept as-is for a rescued copy. */
  settings: unknown;
  /** true for the 使い方ガイド / おためしデモ text, which is never saved. */
  sample: boolean;
}

let latest: EditorRescue | null = null;

/** Called on every screen change; keeps references only (no copying). */
export function noteEditorScreen(screen: EditorRescue): void {
  latest = screen;
}

export function readEditorRescue(): EditorRescue | null {
  return latest;
}

export function clearEditorRescue(): void {
  latest = null;
}

/** Whether there is anything worth handing back. */
export function hasRescuableText(rescue: EditorRescue | null): rescue is EditorRescue {
  return !!rescue && (rescue.content.trim().length > 0 || rescue.plotNote.trim().length > 0);
}

export function rescueTitle(title: string): string {
  return `${title.trim() || "無題"}（救出した控え）`;
}

/** File name for the TXT download: characters Windows and phones refuse are replaced. */
export function rescueFilename(title: string): string {
  const stem = (title.trim() || "無題").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 60);
  return `${stem}_救出.txt`;
}

/** The TXT body: the manuscript, then the work's memo (if any) after a rule. */
export function rescueText(rescue: Pick<EditorRescue, "title" | "content" | "plotNote">): string {
  const parts = [rescue.content];
  if (rescue.plotNote.trim()) parts.push("――― 作品のメモ ―――", rescue.plotNote);
  return parts.join("\n\n");
}

/** Human-readable reason a work could not be opened. */
export type EditorLoadFailure =
  | { kind: "storage"; detail: string }
  | { kind: "cloud-unreachable"; detail: string; deviceCopyId: number | null }
  | { kind: "cloud-signed-out"; deviceCopyId: number | null }
  | { kind: "cloud-missing"; deviceCopyId: number | null }
  | { kind: "in-trash" }
  | { kind: "local-missing" }
  | { kind: "other"; detail: string };

// Dexie / IndexedDB errors that mean "this browser's storage cannot be used"
// (private mode, blocked site data, a full disk, a broken database).
const STORAGE_ERROR_NAMES = new Set([
  "MissingAPIError",
  "OpenFailedError",
  "DatabaseClosedError",
  "InvalidStateError",
  "SecurityError",
  "UnknownError",
  "QuotaExceededError",
  "VersionError",
  "AbortError",
]);

export function classifyLoadError(error: unknown): EditorLoadFailure {
  const name = (error as { name?: string } | null)?.name ?? "";
  const inner = (error as { inner?: { name?: string } } | null)?.inner?.name ?? "";
  const detail = error instanceof Error ? error.message : String(error);
  if (STORAGE_ERROR_NAMES.has(name) || STORAGE_ERROR_NAMES.has(inner)) return { kind: "storage", detail };
  return { kind: "other", detail };
}

export function loadFailureMessage(failure: EditorLoadFailure): string {
  switch (failure.kind) {
    case "storage":
      return "このブラウザの保存場所が使えないため、作品を開けませんでした。プライベートモードや、サイトのデータを保存しない設定では使えないことがあります。";
    case "cloud-unreachable":
      return "クラウドに接続できなかったため、作品を開けませんでした。通信を確かめてから、もう一度読み込んでください。";
    case "cloud-signed-out":
      return "ログインが切れているため、クラウドの作品を開けませんでした。ログインしてから、もう一度読み込んでください。";
    case "cloud-missing":
      return "この作品はクラウドに見つかりませんでした（別の端末で削除されたかもしれません）。";
    case "local-missing":
      return "この作品は見つかりませんでした（完全に削除されたかもしれません）。";
    case "in-trash":
      return "この作品はゴミ箱にあります。本棚の「ゴミ箱」から元に戻すと、また開けます。";
    case "other":
      return "作品を読み込めませんでした。もう一度読み込んでください。";
  }
}
