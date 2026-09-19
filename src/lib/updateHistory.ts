export const UPDATE_HISTORY_TYPES = [
  "feature",
  "fix",
  "improvement",
  "notice",
] as const;

export type UpdateHistoryType = (typeof UPDATE_HISTORY_TYPES)[number];

export type UpdateHistoryEntry = {
  date: string;
  title: string;
  detail: string;
  type?: UpdateHistoryType;
};

const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{2}$/;

function isHistoryType(value: unknown): value is UpdateHistoryType {
  return (
    typeof value === "string" &&
    UPDATE_HISTORY_TYPES.includes(value as UpdateHistoryType)
  );
}

function isUpdateHistoryEntry(value: unknown): value is UpdateHistoryEntry {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.date !== "string" ||
    !DATE_PATTERN.test(candidate.date) ||
    typeof candidate.title !== "string" ||
    candidate.title.trim().length === 0 ||
    typeof candidate.detail !== "string" ||
    candidate.detail.trim().length === 0
  ) {
    return false;
  }

  return candidate.type === undefined || isHistoryType(candidate.type);
}

export function parseUpdateHistory(value: unknown): UpdateHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isUpdateHistoryEntry);
}
